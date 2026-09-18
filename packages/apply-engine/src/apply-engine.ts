import path from "path";
import { WorkspaceVerifier } from "@mcp-platform/verification-engine";
import type { ApplyReceipt, ApplyReport, ApplyRequest, ApplyResult, ApplyStatus } from "./types.js";
import { WorkspaceValidator } from "./preflight/workspace-validator.js";
import { PlanValidator } from "./preflight/plan-validator.js";
import { ReceiptChainValidator } from "./preflight/receipt-validator.js";
import { RevisionValidator } from "./preflight/revision-validator.js";
import { DirtyTreeValidator } from "./preflight/dirty-tree-validator.js";
import { WorkspaceLock } from "./transactions/workspace-lock.js";
import { WorkspaceSnapshotManager } from "./transactions/workspace-snapshot.js";
import { MutationJournalManager } from "./transactions/mutation-journal.js";
import { RollbackManager } from "./transactions/rollback-manager.js";
import { MutationEngine } from "./mutations/mutation-engine.js";
import { DiffValidator } from "./verification/diff-validator.js";
import { PostApplyVerifier } from "./verification/post-apply-verifier.js";
import { ApplyReportBuilder } from "./reports/apply-report.js";

export class ApplyEngine {
  public static async apply(request: ApplyRequest): Promise<ApplyResult> {
    const applyId = `APPLY-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const txId = `TX-${applyId}`;
    const workspaceRoot = path.resolve(request.workspaceRoot);

    // 1. Workspace validation
    const wsVal = WorkspaceValidator.validate(workspaceRoot);
    if (!wsVal.valid) {
      return this.failPrecheck(applyId, workspaceRoot, wsVal.reason || "Invalid workspace root", request);
    }

    // 2. Plan validation & digest calculation
    const planVal = PlanValidator.validate(request.changePlan);
    if (!planVal.valid) {
      return this.failPrecheck(applyId, workspaceRoot, planVal.reason || "Invalid ChangePlan", request);
    }

    // 3. Receipt Chain validation (VerificationReceipt + ApprovalReceipt)
    const chainVal = ReceiptChainValidator.validate({
      changePlan: request.changePlan,
      calculatedPlanDigest: planVal.digest,
      verificationReceipt: request.verificationReceipt,
      approvalReceipt: request.approvalReceipt,
      secretKey: request.options?.customSecretKey
    });

    if (!chainVal.valid) {
      return this.failPrecheck(applyId, workspaceRoot, chainVal.reason || "Receipt chain validation failed", request);
    }

    // 4. Dirty tree validation
    const dirtyVal = DirtyTreeValidator.validate(workspaceRoot, request.options?.allowDirtyTreeForTest);
    if (!dirtyVal.isClean) {
      return this.failPrecheck(applyId, workspaceRoot, dirtyVal.reason || "Dirty worktree detected", request);
    }

    // 5. Initial Revision validation (Commit matching)
    const revVal = RevisionValidator.validate({
      workspaceRoot,
      expectedRevision: request.verificationReceipt.repository_revision,
      customCurrentRevision: request.options?.customCurrentRevision
    });
    if (!revVal.valid) {
      return this.failPrecheck(applyId, workspaceRoot, revVal.reason || "Repository revision mismatch", request);
    }

    // 6. Acquire Workspace Lock
    const lock = WorkspaceLock.acquire(workspaceRoot, txId);
    if (!lock.acquired) {
      return this.failPrecheck(applyId, workspaceRoot, lock.reason || "Could not acquire workspace lock", request);
    }

    let journal = MutationJournalManager.initJournal(workspaceRoot, txId);

    try {
      // 7. Build Manifest & Target Paths
      const { manifest, targetRelativePaths } = MutationEngine.buildManifest({
        workspaceRoot,
        transactionId: txId,
        changePlan: request.changePlan,
        verticalSlicePlan: request.verticalSlicePlan
      });

      // 8. Create Byte-for-Byte Snapshot
      const snapshot = WorkspaceSnapshotManager.createSnapshot({
        workspaceRoot,
        transactionId: txId,
        targetPaths: targetRelativePaths
      });

      // 9. Re-validate Revision Immediately Before First Mutation (Anti-TOCTOU lock)
      const immediateRevVal = RevisionValidator.validate({
        workspaceRoot,
        expectedRevision: request.verificationReceipt.repository_revision,
        customCurrentRevision: request.options?.customCurrentRevision
      });
      if (!immediateRevVal.valid) {
        WorkspaceLock.release(workspaceRoot, txId);
        return this.failPrecheck(applyId, workspaceRoot, immediateRevVal.reason || "Repository revision changed immediately before write", request);
      }

      // Dry run mode check
      if (request.options?.dryRun) {
        WorkspaceSnapshotManager.cleanSnapshot(workspaceRoot, txId);
        WorkspaceLock.release(workspaceRoot, txId);
        return {
          report: {
            schema_version: 1,
            apply_id: applyId,
            status: "APPLIED",
            plan_digest: planVal.digest,
            verification_digest: request.verificationReceipt.verification_digest,
            approval_id: request.approvalReceipt.approval_id,
            repository_before: revVal.currentRevision,
            mutations_planned: manifest.mutations.length,
            mutations_applied: 0,
            actual_change_surface: { files_created: [], files_modified: [], files_deleted: [], lines_added: 0, lines_removed: 0, total_bytes_written: 0 },
            journal,
            created_at: new Date().toISOString()
          },
          markdown: "# DRY RUN COMPLETED (NO MUTATIONS APPLIED)"
        };
      }

      // 10. Execute Mutations
      const mutationResult = await MutationEngine.executeMutations({
        workspaceRoot,
        manifest,
        journal
      });

      if (!mutationResult.success) {
        // Trigger Rollback
        const rollbackReport = RollbackManager.executeRollback({
          workspaceRoot,
          snapshot,
          createdFiles: mutationResult.createdFiles,
          modifiedFiles: mutationResult.modifiedFiles
        });

        const status: ApplyStatus = rollbackReport.status === "SUCCESS" ? "FAILED_ROLLED_BACK" : "ROLLBACK_FAILED";
        MutationJournalManager.finalizeJournal(workspaceRoot, journal);
        WorkspaceLock.release(workspaceRoot, txId);

        const report: ApplyReport = {
          schema_version: 1,
          apply_id: applyId,
          status,
          plan_digest: planVal.digest,
          verification_digest: request.verificationReceipt.verification_digest,
          approval_id: request.approvalReceipt.approval_id,
          repository_before: revVal.currentRevision,
          mutations_planned: manifest.mutations.length,
          mutations_applied: mutationResult.appliedItems.length,
          actual_change_surface: mutationResult.actualSurface,
          rollback_report: rollbackReport,
          journal,
          created_at: new Date().toISOString(),
          error: mutationResult.error
        };

        return {
          report,
          markdown: ApplyReportBuilder.generateMarkdown(report)
        };
      }

      // 11. Validate Diff Surface (PLANNED vs ACTUAL)
      const diffReport = DiffValidator.validate({
        changePlan: request.changePlan,
        actualSurface: mutationResult.actualSurface
      });

      if (!diffReport.matches_plan) {
        const rollbackReport = RollbackManager.executeRollback({
          workspaceRoot,
          snapshot,
          createdFiles: mutationResult.createdFiles,
          modifiedFiles: mutationResult.modifiedFiles
        });

        const status: ApplyStatus = rollbackReport.status === "SUCCESS" ? "FAILED_ROLLED_BACK" : "ROLLBACK_FAILED";
        MutationJournalManager.finalizeJournal(workspaceRoot, journal);
        WorkspaceLock.release(workspaceRoot, txId);

        const report: ApplyReport = {
          schema_version: 1,
          apply_id: applyId,
          status,
          plan_digest: planVal.digest,
          verification_digest: request.verificationReceipt.verification_digest,
          approval_id: request.approvalReceipt.approval_id,
          repository_before: revVal.currentRevision,
          mutations_planned: manifest.mutations.length,
          mutations_applied: mutationResult.appliedItems.length,
          actual_change_surface: mutationResult.actualSurface,
          rollback_report: rollbackReport,
          journal,
          created_at: new Date().toISOString(),
          error: `Diff surface mismatch: undeclared mutations detected [${diffReport.unexpected_mutations.join(", ")}] or missing mutations [${diffReport.missing_mutations.join(", ")}].`
        };

        return {
          report,
          markdown: ApplyReportBuilder.generateMarkdown(report)
        };
      }

      // 12. Post-Apply Verification Integration
      let postVerificationReport = undefined;
      if (!request.options?.skipPostApplyTestExecution) {
        const postVerif = await PostApplyVerifier.verify({
          workspaceRoot,
          repositoryManifest: request.repositoryManifest,
          architectureGraph: request.architectureGraph,
          changePlan: request.changePlan,
          verticalSlicePlan: request.verticalSlicePlan
        });

        postVerificationReport = postVerif.report;

        if (!postVerif.success) {
          const rollbackReport = RollbackManager.executeRollback({
            workspaceRoot,
            snapshot,
            createdFiles: mutationResult.createdFiles,
            modifiedFiles: mutationResult.modifiedFiles
          });

          const status: ApplyStatus = rollbackReport.status === "SUCCESS" ? "FAILED_ROLLED_BACK" : "ROLLBACK_FAILED";
          MutationJournalManager.finalizeJournal(workspaceRoot, journal);
          WorkspaceLock.release(workspaceRoot, txId);

          const report: ApplyReport = {
            schema_version: 1,
            apply_id: applyId,
            status,
            plan_digest: planVal.digest,
            verification_digest: request.verificationReceipt.verification_digest,
            approval_id: request.approvalReceipt.approval_id,
            repository_before: revVal.currentRevision,
            mutations_planned: manifest.mutations.length,
            mutations_applied: mutationResult.appliedItems.length,
            actual_change_surface: mutationResult.actualSurface,
            verification_result: postVerificationReport,
            rollback_report: rollbackReport,
            journal,
            created_at: new Date().toISOString(),
            error: postVerif.error
          };

          return {
            report,
            markdown: ApplyReportBuilder.generateMarkdown(report)
          };
        }
      }

      // 13. Finalize & Emit Receipts
      MutationJournalManager.finalizeJournal(workspaceRoot, journal);
      WorkspaceSnapshotManager.cleanSnapshot(workspaceRoot, txId);
      WorkspaceLock.release(workspaceRoot, txId);

      const repositoryAfter = WorkspaceVerifier.captureRevision(workspaceRoot);

      const report: ApplyReport = {
        schema_version: 1,
        apply_id: applyId,
        status: "APPLIED_VERIFIED",
        plan_digest: planVal.digest,
        verification_digest: request.verificationReceipt.verification_digest,
        approval_id: request.approvalReceipt.approval_id,
        repository_before: revVal.currentRevision,
        repository_after: repositoryAfter,
        mutations_planned: manifest.mutations.length,
        mutations_applied: mutationResult.appliedItems.length,
        actual_change_surface: mutationResult.actualSurface,
        verification_result: postVerificationReport,
        journal,
        created_at: new Date().toISOString()
      };

      const receipt = ApplyReportBuilder.buildReceipt(report);
      const markdown = ApplyReportBuilder.generateMarkdown(report, receipt);

      return {
        report,
        receipt,
        markdown
      };
    } catch (err: any) {
      WorkspaceLock.release(workspaceRoot, txId);
      return this.failPrecheck(applyId, workspaceRoot, `Unhandled exception in ApplyEngine: ${err.message}`, request);
    }
  }

  private static failPrecheck(
    applyId: string,
    workspaceRoot: string,
    reason: string,
    request: ApplyRequest
  ): ApplyResult {
    const report: ApplyReport = {
      schema_version: 1,
      apply_id: applyId,
      status: "PRECHECK_FAILED",
      plan_digest: request.verificationReceipt?.change_plan_digest || "UNKNOWN",
      verification_digest: request.verificationReceipt?.verification_digest || "UNKNOWN",
      approval_id: request.approvalReceipt?.approval_id || "UNKNOWN",
      repository_before: request.verificationReceipt?.repository_revision || {
        commitSha: "UNKNOWN",
        branch: "UNKNOWN",
        dirty: true,
        capturedAt: new Date().toISOString()
      },
      mutations_planned: request.changePlan?.operations?.length || 0,
      mutations_applied: 0,
      actual_change_surface: {
        files_created: [],
        files_modified: [],
        files_deleted: [],
        lines_added: 0,
        lines_removed: 0,
        total_bytes_written: 0
      },
      journal: {
        transaction_id: `TX-${applyId}`,
        started_at: new Date().toISOString(),
        entries: []
      },
      created_at: new Date().toISOString(),
      error: reason
    };

    return {
      report,
      markdown: ApplyReportBuilder.generateMarkdown(report)
    };
  }
}
