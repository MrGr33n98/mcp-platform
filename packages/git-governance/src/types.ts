import type { RepositoryRevision, VerificationReceipt } from "@mcp-platform/verification-engine";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ApplyReceipt, ApplyReport, ApproverType } from "@mcp-platform/apply-engine";

export type GitApprovalScopeType =
  | "CREATE_BRANCH"
  | "STAGE"
  | "COMMIT"
  | "PUSH"
  | "CREATE_PR";

export interface GitApprovalScope {
  scopes: GitApprovalScopeType[];
  target_branch?: string | undefined;
  target_remote?: string | undefined;
  custom_commit_message?: string | undefined;
}

export interface GitApprovalReceipt {
  schema_version: number;
  approval_id: string;
  approver_id: string;
  approver_type: ApproverType;
  approved_at: string;
  expires_at: string;
  apply_id: string;
  change_plan_digest: string;
  verification_digest: string;
  repository_revision: RepositoryRevision;
  workspace_id: string;
  scope: GitApprovalScope;
  nonce: string;
  signature_or_mac: string;
}

export type GitStatus =
  | "PRECHECK"
  | "BRANCH_CREATED"
  | "STAGED"
  | "STAGE_VERIFIED"
  | "COMMITTED"
  | "COMMIT_VERIFIED"
  | "PUSHED"
  | "PR_CREATED"
  | "FAILED";

export type DiffClassification =
  | "EXPECTED"
  | "UNEXPECTED"
  | "IGNORED"
  | "GENERATED"
  | "SENSITIVE";

export type SecretSeverity =
  | "CONFIRMED_SECRET"
  | "LIKELY_SECRET"
  | "POSSIBLE_SECRET";

export interface SecretFinding {
  file: string;
  line: number;
  secret_type: string;
  severity: SecretSeverity;
  redacted_fingerprint: string;
}

export interface FileDiffSummary {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  lines_added: number;
  lines_removed: number;
  classification: DiffClassification;
}

export interface DiffReport {
  files: FileDiffSummary[];
  total_lines_added: number;
  total_lines_removed: number;
  unclassified_or_unexpected: string[];
  is_consistent_with_plan: boolean;
  diff_digest: string;
}

export interface CommitMetadata {
  commit_sha: string;
  parent_sha: string;
  tree_sha: string;
  author: string;
  message: string;
  timestamp: string;
  files_committed: string[];
  diff_digest: string;
  change_plan_digest: string;
  verification_digest: string;
  apply_id: string;
  approval_id: string;
}

export interface CommitReport {
  commit_metadata: CommitMetadata;
  verification_status: "VERIFIED" | "DISCREPANCY_DETECTED";
  working_tree_clean: boolean;
  error?: string | undefined;
}

export interface PushReport {
  remote_name: string;
  remote_url_fingerprint: string;
  branch_name: string;
  commit_sha: string;
  pushed_at: string;
  status: "SUCCESS" | "SKIPPED" | "FAILED";
  error?: string | undefined;
}

export interface PRPlan {
  repository: string;
  base_branch: string;
  head_branch: string;
  title: string;
  body: string;
  commits: string[];
  change_summary: string;
  verification_summary: string;
  risk_summary: string;
  test_summary: string;
  rollback_summary: string;
}

export interface PRReport {
  pr_id?: string | undefined;
  pr_url?: string | undefined;
  pr_number?: number | undefined;
  provider: string;
  status: "CREATED" | "SKIPPED" | "FAILED";
  created_at: string;
  error?: string | undefined;
}

export interface GitOperationJournalEntry {
  sequence: number;
  status: GitStatus;
  detail: string;
  timestamp: string;
  error?: string | undefined;
}

export interface GitOperationJournal {
  operation_id: string;
  started_at: string;
  completed_at?: string | undefined;
  entries: GitOperationJournalEntry[];
}

export interface GitReport {
  schema_version: number;
  git_operation_id: string;
  status: GitStatus;
  apply_id: string;
  change_plan_digest: string;
  verification_digest: string;
  approval_id: string;
  repository: string;
  source_revision: RepositoryRevision;
  branch: string;
  diff_report: DiffReport;
  secret_findings: SecretFinding[];
  commit_report?: CommitReport | undefined;
  push_report?: PushReport | undefined;
  pr_report?: PRReport | undefined;
  journal: GitOperationJournal;
  created_at: string;
  error?: string | undefined;
}

export interface GitReceipt {
  schema_version: number;
  receipt_type: "GIT_RECEIPT";
  git_operation_id: string;
  repository: string;
  source_revision: RepositoryRevision;
  branch: string;
  commit_sha: string;
  commit_diff_digest: string;
  change_plan_digest: string;
  verification_digest: string;
  apply_id: string;
  push_status: "PUSHED" | "LOCAL_ONLY" | "SKIPPED";
  pr_status: "PR_CREATED" | "NOT_REQUESTED" | "SKIPPED";
  status: GitStatus;
  timestamp: string;
}

export interface PullRequestProvider {
  name: string;
  createPullRequest(plan: PRPlan, options?: Record<string, unknown> | undefined): Promise<PRReport>;
}

export interface GitGovernanceRequest {
  workspaceRoot: string;
  changePlan: ChangePlan;
  verticalSlicePlan?: VerticalSlicePlan | undefined;
  applyReceipt: ApplyReceipt;
  applyReport?: ApplyReport | undefined;
  verificationReceipt: VerificationReceipt;
  gitApprovalReceipt: GitApprovalReceipt;
  prProvider?: PullRequestProvider | undefined;
  options?: {
    customSecretKey?: string | undefined;
    allowDirtyTreeForTest?: boolean | undefined;
    dryRun?: boolean | undefined;
  } | undefined;
}

export interface GitGovernanceResult {
  report: GitReport;
  receipt?: GitReceipt | undefined;
  markdown: string;
}
