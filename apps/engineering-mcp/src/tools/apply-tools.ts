import type { ToolDefinition } from "@mcp-platform/core";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import {
  ApplyEngine,
  RollbackManager,
  type ApprovalReceipt,
  type WorkspaceSnapshotData,
} from "@mcp-platform/apply-engine";
import { PathBoundaryValidator } from "../security/path-boundary-validator.js";
import { ApprovalSecurityValidator } from "../security/approval-validator.js";
import {
  previewApplyInputSchema,
  applyChangeInputSchema,
  rollbackApplyInputSchema,
} from "../schemas/apply.js";

export function createPreviewApplyTool(): ToolDefinition<typeof previewApplyInputSchema> {
  return {
    name: "engineering_preview_apply",
    description: "Simulate change application in dry-run mode with zero filesystem mutations.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: previewApplyInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      const changePlan = input.change_plan as unknown as ChangePlan;
      const verticalSlicePlan = input.vertical_slice_plan as unknown as VerticalSlicePlan;
      const verificationReceipt = input.verification_receipt as unknown as VerificationReceipt;
      const approvalReceipt = input.approval_receipt as unknown as ApprovalReceipt;

      const result = await ApplyEngine.apply({
        workspaceRoot: canonicalRoot,
        changePlan,
        verticalSlicePlan,
        repositoryManifest: manifest,
        architectureGraph: graph,
        verificationReceipt,
        approvalReceipt,
        options: {
          dryRun: true,
          customSecretKey: input.options?.customSecretKey,
          allowDirtyTreeForTest: input.options?.allowDirtyTreeForTest,
        },
      });

      return {
        repository_path: canonicalRoot,
        status: result.report.status,
        mutations_planned: result.report.mutations_planned,
        mutations_applied: 0,
        dry_run: true,
        report: result.report,
        markdown: result.markdown,
      };
    },
  };
}

export function createApplyChangeTool(): ToolDefinition<typeof applyChangeInputSchema> {
  return {
    name: "engineering_apply_change",
    description: "Apply verified change plan with transaction locks, snapshot protection, diff check, and rollback.",
    readOnly: false,
    riskLevel: "destructive",
    inputSchema: applyChangeInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);

      const approvalReceipt = input.approval_receipt as unknown as ApprovalReceipt;
      ApprovalSecurityValidator.validateApplyApproval(approvalReceipt, input.options?.customSecretKey);

      const manifest = await RepositoryScanner.scan(canonicalRoot);
      const graph = ArchitectureGraphBuilder.build(manifest);

      const changePlan = input.change_plan as unknown as ChangePlan;
      const verticalSlicePlan = input.vertical_slice_plan as unknown as VerticalSlicePlan;
      const verificationReceipt = input.verification_receipt as unknown as VerificationReceipt;

      const result = await ApplyEngine.apply({
        workspaceRoot: canonicalRoot,
        changePlan,
        verticalSlicePlan,
        repositoryManifest: manifest,
        architectureGraph: graph,
        verificationReceipt,
        approvalReceipt,
        options: {
          dryRun: input.options?.dryRun,
          skipPostApplyTestExecution: input.options?.skipPostApplyTestExecution,
          customSecretKey: input.options?.customSecretKey,
          allowDirtyTreeForTest: input.options?.allowDirtyTreeForTest,
        },
      });

      return {
        repository_path: canonicalRoot,
        status: result.report.status,
        apply_id: result.report.apply_id,
        mutations_applied: result.report.mutations_applied,
        actual_change_surface: result.report.actual_change_surface,
        report: result.report,
        receipt: result.receipt,
        markdown: result.markdown,
      };
    },
  };
}

export function createRollbackApplyTool(): ToolDefinition<typeof rollbackApplyInputSchema> {
  return {
    name: "engineering_rollback_apply",
    description: "Restore repository to byte-for-byte pre-mutation snapshot following a failed apply.",
    readOnly: false,
    riskLevel: "destructive",
    inputSchema: rollbackApplyInputSchema,
    async execute(_context, input) {
      const canonicalRoot = PathBoundaryValidator.validateRepositoryRoot(input.repository_path);
      const snapshot = input.snapshot_data as unknown as WorkspaceSnapshotData;

      const report = RollbackManager.executeRollback({
        workspaceRoot: canonicalRoot,
        snapshot,
        createdFiles: input.created_files || [],
        modifiedFiles: input.modified_files || [],
      });

      return {
        repository_path: canonicalRoot,
        status: report.status,
        files_restored_count: report.files_restored_count,
        files_deleted_count: report.files_deleted_count,
        discrepancies: report.discrepancies,
        report,
      };
    },
  };
}
