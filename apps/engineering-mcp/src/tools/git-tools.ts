import type { ToolDefinition } from "@mcp-platform/core";
import {
  GitClient,
  BranchManager,
  GitGovernanceEngine,
  BranchValidator,
  type GitApprovalReceipt,
} from "@mcp-platform/git-governance";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { ApprovalSecurityValidator } from "../security/approval-validator.js";
import {
  gitStatusInputSchema,
  prepareBranchInputSchema,
  prepareCommitInputSchema,
} from "../schemas/git.js";
import { McpPlatformError } from "@mcp-platform/core";

export function createGitStatusTool(): ToolDefinition<typeof gitStatusInputSchema> {
  return {
    name: "engineering_git_status",
    description: "Query git repository status, current branch, HEAD commit, and working tree cleanliness.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: gitStatusInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const git = new GitClient(canonicalRoot);

      try {
        const currentBranch = await git.getCurrentBranch();
        const headCommit = await git.getHeadCommit();
        const statusOutput = await git.getStatus();
        const unstagedDiff = await git.getUnstagedDiff();
        const stagedDiff = await git.getStagedDiff();
        const trackedFiles = await git.listTrackedFiles();

        const isClean = statusOutput.trim().length === 0;

        return {
          repository_path: canonicalRoot,
          branch: currentBranch,
          head_commit: headCommit,
          is_working_tree_clean: isClean,
          tracked_files_count: trackedFiles.length,
          has_unstaged_changes: unstagedDiff.trim().length > 0,
          has_staged_changes: stagedDiff.trim().length > 0,
          status_summary: statusOutput,
        };
      } catch (err: unknown) {
        throw new McpPlatformError({
          code: "GIT_EXECUTION_ERROR",
          message: `Failed to query git status: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };
}

export function createPrepareBranchTool(): ToolDefinition<typeof prepareBranchInputSchema> {
  return {
    name: "engineering_prepare_branch",
    description: "Validate and create an isolated working branch avoiding protected branches.",
    readOnly: false,
    riskLevel: "write",
    inputSchema: prepareBranchInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const branchCheck = BranchValidator.validate(input.branch_name);

      if (!branchCheck.valid) {
        throw new McpPlatformError({
          code: "INVALID_BRANCH_NAME",
          message: `Branch name '${input.branch_name}' violates branch policy: ${branchCheck.errors.join("; ")}`,
        });
      }

      const git = new GitClient(canonicalRoot);
      const branchManager = new BranchManager(git);

      try {
        const res = await branchManager.createIsolatedBranch("feature", "mcp", input.branch_name);
        return {
          repository_path: canonicalRoot,
          branch_name: res.branchName,
          source_branch: res.sourceBranch,
          source_commit: res.sourceCommit,
          status: "BRANCH_CREATED",
          message: `Isolated branch '${res.branchName}' created and checked out successfully.`,
        };
      } catch (err: unknown) {
        throw new McpPlatformError({
          code: "BRANCH_CREATION_FAILED",
          message: `Failed to create branch '${input.branch_name}': ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };
}

export function createPrepareCommitTool(): ToolDefinition<typeof prepareCommitInputSchema> {
  return {
    name: "engineering_prepare_commit",
    description: "Perform selective staging, secret-in-diff verification, and create governed commit with receipts.",
    readOnly: false,
    riskLevel: "destructive",
    inputSchema: prepareCommitInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);

      const gitApprovalReceipt = input.git_approval_receipt as unknown as GitApprovalReceipt;
      ApprovalSecurityValidator.validateGitApproval(gitApprovalReceipt, input.options?.customSecretKey);

      const changePlan = input.change_plan as unknown as ChangePlan;
      const verticalSlicePlan = input.vertical_slice_plan as unknown as VerticalSlicePlan | undefined;
      const applyReceipt = input.apply_receipt as unknown as ApplyReceipt;
      const verificationReceipt = input.verification_receipt as unknown as VerificationReceipt;

      const result = await GitGovernanceEngine.execute({
        workspaceRoot: canonicalRoot,
        changePlan,
        verticalSlicePlan,
        applyReceipt,
        verificationReceipt,
        gitApprovalReceipt,
        options: {
          customSecretKey: input.options?.customSecretKey,
          allowDirtyTreeForTest: input.options?.allowDirtyTreeForTest,
          dryRun: input.options?.dryRun,
        },
      });

      return {
        repository_path: canonicalRoot,
        status: result.report.status,
        git_operation_id: result.report.git_operation_id,
        branch: result.report.branch,
        commit_report: result.report.commit_report,
        secret_findings: result.report.secret_findings,
        report: result.report,
        receipt: result.receipt,
        markdown: result.markdown,
      };
    },
  };
}
