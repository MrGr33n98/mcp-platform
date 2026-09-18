import type { RepositoryManifest, ProductWorkspace } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";

export type VerificationMode = "STATIC_VERIFY" | "SAFE_TEST" | "SAFE_BUILD";
export type CheckExecutionStatus = "STATIC" | "EXECUTED" | "NOT_EXECUTED" | "NOT_VERIFIED";
export type FailureSeverity = "BLOCKER" | "ERROR" | "WARNING" | "INFO";
export type VerificationStatus = "PASS" | "CONDITIONAL_PASS" | "FAIL";
export type CommandClass =
  | "READ_ONLY"
  | "SAFE_BUILD"
  | "SAFE_TEST"
  | "WRITE_LOCAL"
  | "MIGRATION"
  | "GIT_WRITE"
  | "DEPLOY"
  | "DESTRUCTIVE";
export type MigrationSafety = "SAFE" | "REQUIRES_REVIEW" | "UNSAFE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface VerificationCheckResult {
  id: string;
  name: string;
  category: string;
  status: CheckExecutionStatus;
  verdict: "PASS" | "FAIL" | "WARNING" | "NOT_VERIFIED";
  severity: FailureSeverity;
  message: string;
  details?: Record<string, unknown> | undefined;
}

export interface RepositoryRevision {
  commitSha: string;
  branch: string;
  dirty: boolean;
  capturedAt: string;
}

export interface ChangePlanDigest {
  algorithm: "sha256";
  hash: string;
  canonicalizedOperationsCount: number;
}

export interface ChangeSurfaceReport {
  files_to_create: string[];
  files_to_modify: string[];
  tables_affected: string[];
  routes_affected: string[];
  models_affected: string[];
  policies_affected: string[];
  jobs_affected: string[];
  frontend_affected: string[];
  tests_affected: string[];
  total_operations: number;
}

export interface BlastRadius {
  direct: string[];
  transitive: string[];
  critical: string[];
  testsProtecting: string[];
  impactedComponentsCount: number;
}

export interface SecurityFinding {
  ruleId: string;
  severity: FailureSeverity;
  description: string;
  remediation: string;
  mitigatedInPlan: boolean;
}

export interface VerificationReport {
  schema_version: 1;
  verification_id: string;
  created_at: string;
  target: {
    product: string;
    capability: string;
  };
  repository_revision: RepositoryRevision;
  change_plan_digest: string;
  status: VerificationStatus;
  mode: VerificationMode;
  checks: VerificationCheckResult[];
  evidence: Array<{ file: string; symbol?: string | undefined; reason: string }>;
  failures: Array<{ checkId: string; message: string; severity: FailureSeverity }>;
  warnings: Array<{ checkId: string; message: string }>;
  security_findings: SecurityFinding[];
  commands_executed: Array<{ command: string; duration_ms: number; status: "OK" | "FAILED" }>;
  commands_blocked: Array<{ command: string; reason: string }>;
  assumptions: string[];
  not_verified: string[];
  coverage: {
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
    notVerifiedCount: number;
  };
  change_surface: ChangeSurfaceReport;
  blast_radius: BlastRadius;
  approval_status: "AWAITING_HUMAN_APPROVAL" | "REJECTED" | "APPROVED";
}

export interface VerificationReceipt {
  schema_version: 1;
  receipt_type: "VERIFICATION_RECEIPT";
  verification_id: string;
  change_plan_digest: string;
  repository_revision: RepositoryRevision;
  verification_status: VerificationStatus;
  verification_digest: string;
  timestamp: string;
}

export interface ApprovalReceipt {
  schema_version: 1;
  receipt_type: "APPROVAL_RECEIPT";
  approval_id: string;
  verification_receipt_id: string;
  change_plan_digest: string;
  approver: string;
  approved_at: string;
  comments?: string | undefined;
}

export interface VerificationRequest {
  repositoryManifest: RepositoryManifest;
  architectureGraph: ArchitectureGraphData;
  changePlan: ChangePlan;
  verticalSlicePlan: VerticalSlicePlan;
  workspace?: ProductWorkspace | undefined;
  verificationProfile?: "RAILS_PROFILE" | "NEXT_PROFILE" | "DOCKER_PROFILE" | "FULL_STACK_PROFILE" | undefined;
  options?: {
    mode?: VerificationMode | undefined;
    allowExecutedTests?: boolean | undefined;
    customRevision?: RepositoryRevision | undefined;
  } | undefined;
}
