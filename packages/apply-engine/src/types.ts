import type { RepositoryRevision, VerificationReceipt, VerificationReport } from "@mcp-platform/verification-engine";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";

export type ApproverType = "HUMAN_OPERATOR" | "AUTOMATED_POLICY" | "SECURITY_OFFICER" | "DEV_LOCAL";

export interface ApprovalScope {
  entire_change_plan: boolean;
  operations?: string[];
  max_risk_level?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface ApprovalReceipt {
  schema_version: number;
  approval_id: string;
  approver_id: string;
  approver_type: ApproverType;
  approved_at: string;
  expires_at: string;
  change_plan_digest: string;
  verification_digest: string;
  repository_revision: RepositoryRevision;
  workspace_id: string;
  scope: ApprovalScope;
  nonce: string;
  signature_or_mac: string;
}

export type ApplyStatus =
  | "PRECHECK_FAILED"
  | "APPLIED"
  | "APPLIED_VERIFIED"
  | "FAILED_ROLLED_BACK"
  | "ROLLBACK_FAILED";

export type MutationType =
  | "CREATE_FILE"
  | "MODIFY_FILE"
  | "PATCH_FILE"
  | "DELETE_FILE"
  | "RENAME_FILE";

export interface MutationItem {
  operation_id: string;
  type: MutationType;
  relative_path: string;
  absolute_path: string;
  expected_before_hash?: string | null | undefined;
  expected_after_intent: string;
  content?: string | undefined;
  patch?: string | undefined;
  reason: string;
}

export interface MutationManifest {
  manifest_version: number;
  transaction_id: string;
  created_at: string;
  mutations: MutationItem[];
  total_files_created: number;
  total_files_modified: number;
  total_files_deleted: number;
}

export type JournalStatus =
  | "PENDING"
  | "APPLIED"
  | "VERIFIED"
  | "ROLLED_BACK"
  | "FAILED";

export interface MutationJournalEntry {
  sequence: number;
  operation_id: string;
  mutation_type: MutationType;
  path: string;
  before_hash: string | null;
  after_hash: string | null;
  status: JournalStatus;
  timestamp: string;
  error?: string | undefined;
}

export interface MutationJournal {
  transaction_id: string;
  started_at: string;
  completed_at?: string | undefined;
  entries: MutationJournalEntry[];
}

export interface FileSnapshot {
  relative_path: string;
  absolute_path: string;
  existed_before: boolean;
  content_base64: string | null;
  sha256: string | null;
  size_bytes: number;
  mode?: number | undefined;
}

export interface WorkspaceSnapshotData {
  transaction_id: string;
  created_at: string;
  workspace_root: string;
  files: Record<string, FileSnapshot>;
}

export interface RollbackVerificationReport {
  rollback_id: string;
  transaction_id: string;
  restored_at: string;
  status: "SUCCESS" | "FAILED";
  files_restored_count: number;
  files_deleted_count: number;
  discrepancies: Array<{ path: string; expected_hash: string | null; actual_hash: string | null; reason: string }>;
}

export interface ActualChangeSurface {
  files_created: string[];
  files_modified: string[];
  files_deleted: string[];
  lines_added: number;
  lines_removed: number;
  total_bytes_written: number;
}

export interface DiffReport {
  planned_surface: {
    created_count: number;
    modified_count: number;
    deleted_count: number;
    paths: string[];
  };
  actual_surface: ActualChangeSurface;
  matches_plan: boolean;
  unexpected_mutations: string[];
  missing_mutations: string[];
}

export interface ApplyReport {
  schema_version: number;
  apply_id: string;
  status: ApplyStatus;
  plan_digest: string;
  verification_digest: string;
  approval_id: string;
  repository_before: RepositoryRevision;
  repository_after?: RepositoryRevision | undefined;
  mutations_planned: number;
  mutations_applied: number;
  actual_change_surface: ActualChangeSurface;
  verification_result?: VerificationReport | undefined;
  rollback_report?: RollbackVerificationReport | undefined;
  journal: MutationJournal;
  created_at: string;
  error?: string | undefined;
}

export interface ApplyReceipt {
  schema_version: number;
  receipt_type: "APPLY_RECEIPT";
  apply_id: string;
  change_plan_digest: string;
  verification_digest: string;
  approval_id: string;
  repository_before: RepositoryRevision;
  repository_after?: RepositoryRevision | undefined;
  applied_change_digest: string;
  status: ApplyStatus;
  timestamp: string;
}

export interface ApprovalAuthority {
  verify(receipt: ApprovalReceipt, secretOrKey?: string | undefined): Promise<{ valid: boolean; reason?: string | undefined }>;
  sign(receiptData: Omit<ApprovalReceipt, "signature_or_mac">, secretOrKey: string): Promise<string>;
}

export interface ApplyRequest {
  workspaceRoot: string;
  changePlan: ChangePlan;
  verticalSlicePlan: VerticalSlicePlan;
  repositoryManifest: RepositoryManifest;
  architectureGraph: ArchitectureGraphData;
  verificationReceipt: VerificationReceipt;
  approvalReceipt: ApprovalReceipt;
  options?: {
    dryRun?: boolean | undefined;
    skipPostApplyTestExecution?: boolean | undefined;
    customSecretKey?: string | undefined;
    allowDirtyTreeForTest?: boolean | undefined;
    customCurrentRevision?: RepositoryRevision | undefined;
  } | undefined;
}

export interface ApplyResult {
  report: ApplyReport;
  receipt?: ApplyReceipt;
  markdown: string;
}
