import { GitClient } from "./git/git-client.js";
import { BranchManager } from "./git/branch-manager.js";
import { StagingManager } from "./git/staging-manager.js";
import { CommitManager } from "./git/commit-manager.js";
import { PushManager } from "./git/push-manager.js";
import { DiffParser } from "./diff/diff-parser.js";
import { DiffClassifier } from "./diff/diff-classifier.js";
import { SecretDiffScanner } from "./diff/secret-diff-scanner.js";
import { ApplyReceiptValidator } from "./preflight/apply-receipt-validator.js";
import { RepositoryValidator } from "./preflight/repository-validator.js";
import { BranchValidator } from "./preflight/branch-validator.js";
import { GitWorkspaceLock } from "./transactions/git-workspace-lock.js";
import { GitOperationJournalManager } from "./transactions/git-operation-journal.js";
import { PRPlanGenerator } from "./pr/pr-plan.js";
import { GitReportGenerator } from "./reports/git-report.js";
import type {
  GitGovernanceRequest,
  GitGovernanceResult,
  GitReport,
  GitStatus,
  DiffReport,
  SecretFinding,
  CommitReport,
  PushReport,
  PRReport,
} from "./types.js";

export class GitGovernanceEngine {
  public static async execute(request: GitGovernanceRequest): Promise<GitGovernanceResult> {
    const {
      workspaceRoot,
      changePlan,
      verticalSlicePlan,
      applyReceipt,
      verificationReceipt,
      gitApprovalReceipt,
      prProvider,
      options,
    } = request;

    const operationId = `git_op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const journalMgr = new GitOperationJournalManager(workspaceRoot, operationId);
    const lock = new GitWorkspaceLock(workspaceRoot);
    const git = new GitClient(workspaceRoot);

    const declaredFiles = changePlan.operations
      .filter(op => op.type === "CREATE_FILE" || op.type === "MODIFY_FILE")
      .map(op => op.path);

    let currentStatus: GitStatus = "PRECHECK";
    let targetBranchName = "";
    let diffReport: DiffReport = {
      files: [],
      total_lines_added: 0,
      total_lines_removed: 0,
      unclassified_or_unexpected: [],
      is_consistent_with_plan: false,
      diff_digest: "",
    };
    let secretFindings: SecretFinding[] = [];
    let commitReport: CommitReport | undefined = undefined;
    let pushReport: PushReport | undefined = undefined;
    let prReport: PRReport | undefined = undefined;

    try {
      // 1. Crash Recovery check
      const incomplete = GitOperationJournalManager.checkIncompleteOperations(workspaceRoot, operationId);
      if (incomplete.length > 0) {
        throw new Error(
          `Incomplete Git operations detected in workspace (${incomplete.join(", ")}). Reconcile or clean up before proceeding.`
        );
      }

      // 2. Concurrency Lock
      lock.acquire(operationId);
      journalMgr.record("PRECHECK", "Git governance lock acquired.");

      // 3. Preflight Receipt Validation
      const secretKey = options?.customSecretKey || "mcp_platform_default_git_secret_key";
      const receiptCheck = ApplyReceiptValidator.validate(applyReceipt, gitApprovalReceipt, secretKey);
      if (!receiptCheck.valid) {
        throw new Error(`Receipt preflight validation failed:\n${receiptCheck.errors.join("\n")}`);
      }

      // 4. Preflight Repository Binding
      const allowDirty = options?.allowDirtyTreeForTest || false;
      const repoCheck = await RepositoryValidator.validate(git, applyReceipt, declaredFiles, allowDirty);
      if (!repoCheck.valid) {
        throw new Error(`Repository binding validation failed:\n${repoCheck.errors.join("\n")}`);
      }

      // 5. Branch Validation & Isolation
      const branchManager = new BranchManager(git);
      const requestedBranch = gitApprovalReceipt.scope.target_branch;
      if (requestedBranch) {
        const branchCheck = BranchValidator.validate(requestedBranch);
        if (!branchCheck.valid) {
          throw new Error(`Target branch validation failed: ${branchCheck.errors.join(", ")}`);
        }
      }

      if (ApplyReceiptValidator.hasScope(gitApprovalReceipt, "CREATE_BRANCH")) {
        const branchResult = await branchManager.createIsolatedBranch(
          changePlan.capability,
          operationId,
          requestedBranch
        );
        targetBranchName = branchResult.branchName;
        currentStatus = "BRANCH_CREATED";
        journalMgr.record("BRANCH_CREATED", `Switched to isolated branch '${targetBranchName}'.`);
      } else {
        targetBranchName = await git.getCurrentBranch();
      }

      // 6. Inspect Unstaged/Worktree Diff
      const statusOutput = await git.getStatus();
      journalMgr.record("PRECHECK", `Inspecting working tree status: ${statusOutput.trim()}`);

      // 7. Selective Staging
      if (ApplyReceiptValidator.hasScope(gitApprovalReceipt, "STAGE")) {
        const stagingManager = new StagingManager(git);
        const stagedList = await stagingManager.stageDeclaredFiles(declaredFiles);
        currentStatus = "STAGED";
        journalMgr.record("STAGED", `Selectively staged ${stagedList.length} declared files.`);
      }

      // 8. Staged Diff Verification & Secret Scanning
      const rawStagedDiff = await git.getStagedDiff();
      const parsedStaged = DiffParser.parse(rawStagedDiff);
      diffReport = DiffClassifier.classifyDiff(parsedStaged, declaredFiles, rawStagedDiff);

      if (!diffReport.is_consistent_with_plan) {
        throw new Error(
          `Staged diff contains unexpected or sensitive files: ${diffReport.unclassified_or_unexpected.join(", ")}`
        );
      }

      secretFindings = SecretDiffScanner.scanDiffs(parsedStaged);
      const confirmedSecrets = secretFindings.filter(s => s.severity === "CONFIRMED_SECRET");
      if (confirmedSecrets.length > 0) {
        throw new Error(
          `Secret scanning BLOCKED commit: ${confirmedSecrets.length} confirmed secret(s) found in staged diff.`
        );
      }

      currentStatus = "STAGE_VERIFIED";
      journalMgr.record("STAGE_VERIFIED", `Staged diff verified. 0 confirmed secrets.`);

      // 9. Commit Execution
      if (ApplyReceiptValidator.hasScope(gitApprovalReceipt, "COMMIT")) {
        const commitManager = new CommitManager(git);
        commitReport = await commitManager.createGovernanceCommit({
          changePlan,
          verticalSlicePlan,
          applyId: applyReceipt.apply_id,
          approvalId: gitApprovalReceipt.approval_id,
          verificationDigest: applyReceipt.verification_digest,
          stagedFiles: declaredFiles,
          customMessage: gitApprovalReceipt.scope.custom_commit_message,
        });

        currentStatus = "COMMITTED";
        journalMgr.record("COMMITTED", `Commit created: ${commitReport.commit_metadata.commit_sha}`);
        currentStatus = "COMMIT_VERIFIED";
        journalMgr.record("COMMIT_VERIFIED", `Commit provenance verified.`);
      }

      // 10. Optional Push
      if (ApplyReceiptValidator.hasScope(gitApprovalReceipt, "PUSH")) {
        const remoteName = gitApprovalReceipt.scope.target_remote || "origin";
        const pushManager = new PushManager(git);
        pushReport = await pushManager.pushIsolatedBranch(remoteName, targetBranchName);
        currentStatus = "PUSHED";
        journalMgr.record("PUSHED", `Pushed branch '${targetBranchName}' to '${remoteName}'.`);
      }

      // 11. Optional PR Creation
      if (ApplyReceiptValidator.hasScope(gitApprovalReceipt, "CREATE_PR") && prProvider && commitReport) {
        const prPlan = PRPlanGenerator.generatePlan(
          changePlan.product || "workspace",
          "main",
          targetBranchName,
          changePlan,
          applyReceipt,
          [commitReport.commit_metadata.commit_sha],
          gitApprovalReceipt.approval_id,
          verticalSlicePlan
        );

        prReport = await prProvider.createPullRequest(prPlan);
        currentStatus = "PR_CREATED";
        journalMgr.record("PR_CREATED", `PR created with provider '${prProvider.name}'.`);
      }

      journalMgr.complete();

      const finalReport: GitReport = {
        schema_version: 1,
        git_operation_id: operationId,
        status: currentStatus,
        apply_id: applyReceipt.apply_id,
        change_plan_digest: applyReceipt.change_plan_digest,
        verification_digest: applyReceipt.verification_digest,
        approval_id: gitApprovalReceipt.approval_id,
        repository: changePlan.product || workspaceRoot,
        source_revision: applyReceipt.repository_before,
        branch: targetBranchName,
        diff_report: diffReport,
        secret_findings: secretFindings,
        commit_report: commitReport,
        push_report: pushReport,
        pr_report: prReport,
        journal: journalMgr.getJournal(),
        created_at: new Date().toISOString(),
      };

      const receipt = GitReportGenerator.createReceipt(finalReport);
      const markdown = GitReportGenerator.generateMarkdown(finalReport);

      return {
        report: finalReport,
        receipt,
        markdown,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      journalMgr.record("FAILED", `Operation failed: ${errorMessage}`, errorMessage);
      journalMgr.complete();

      const failReport: GitReport = {
        schema_version: 1,
        git_operation_id: operationId,
        status: "FAILED",
        apply_id: applyReceipt.apply_id,
        change_plan_digest: applyReceipt.change_plan_digest,
        verification_digest: applyReceipt.verification_digest,
        approval_id: gitApprovalReceipt.approval_id,
        repository: changePlan.product || workspaceRoot,
        source_revision: applyReceipt.repository_before,
        branch: targetBranchName || "unknown",
        diff_report: diffReport,
        secret_findings: secretFindings,
        journal: journalMgr.getJournal(),
        created_at: new Date().toISOString(),
        error: errorMessage,
      };

      const markdown = GitReportGenerator.generateMarkdown(failReport);

      return {
        report: failReport,
        markdown,
      };
    } finally {
      lock.release();
    }
  }
}
