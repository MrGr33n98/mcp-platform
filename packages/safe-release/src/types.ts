import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import type { ApplyReceipt, ApproverType } from "@mcp-platform/apply-engine";
import type { GitReceipt } from "@mcp-platform/git-governance";
import type { DiagnosticSnapshot, Evidence, Observation } from "@mcp-platform/production-diagnostics";
export type { Evidence };

// Environment Types
export type EnvironmentType =
  | "LOCAL"
  | "TEST"
  | "STAGING"
  | "CANARY"
  | "PRODUCTION";

// Deployment Strategies
export type DeploymentStrategyType =
  | "REPLACE"
  | "ROLLING"
  | "BLUE_GREEN"
  | "CANARY";

// Release State Machine States
export type ReleaseState =
  // Normal Path
  | "CREATED"
  | "CI_VERIFIED"
  | "APPROVAL_PENDING"
  | "APPROVED"
  | "PREPARING"
  | "CANARY_DEPLOYING"
  | "CANARY_OBSERVING"
  | "CANARY_HEALTHY"
  | "PROMOTION_PENDING"
  | "PROMOTING"
  | "PRODUCTION_DEPLOYED"
  | "PRODUCTION_VERIFYING"
  | "PRODUCTION_VERIFIED"
  // Failure / Rollback Path
  | "CI_FAILED"
  | "CANARY_FAILED"
  | "PROMOTION_BLOCKED"
  | "DEPLOY_FAILED"
  | "PRODUCTION_UNHEALTHY"
  | "ROLLBACK_REQUIRED"
  | "ROLLING_BACK"
  | "ROLLED_BACK"
  | "ROLLBACK_FAILED";

// CI Receipts & Checks
export type CICheckStatus = "PASS" | "FAIL" | "SKIPPED";
export type CIReceiptStatus = "PASS" | "FAIL" | "PARTIAL" | "NOT_VERIFIED";

export interface CICheck {
  name: string;
  status: CICheckStatus;
  mandatory: boolean;
  output_excerpt?: string | undefined;
}

export interface CIProvenance {
  trigger_event: string;
  branch: string;
  actor: string;
}

export interface CIReceipt {
  schema_version: number;
  ci_run_id: string;
  provider: string;
  repository: string;
  commit_sha: string;
  workflow: string;
  started_at: string;
  finished_at: string;
  status: CIReceiptStatus;
  checks: CICheck[];
  artifact_digests: string[];
  provenance: CIProvenance;
}

// Artifact Definition & Immutability
export type ArtifactType =
  | "DOCKER_IMAGE"
  | "TARBALL"
  | "DIRECTORY_BUNDLE"
  | "STATIC_ASSETS";

export interface ReleaseArtifact {
  artifact_id: string;
  artifact_type: ArtifactType;
  immutable_tag: string;
  digest: string; // sha256:...
  source_commit: string;
  build_id: string;
}

// Release Candidate
export type ReleaseRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface ReleaseCandidate {
  release_candidate_id: string;
  product: string;
  environment: EnvironmentType;
  commit_sha: string;
  artifact: ReleaseArtifact;
  git_receipt: GitReceipt;
  ci_receipt: CIReceipt;
  change_plan_digest: string;
  verification_digest: string;
  risk_level: ReleaseRiskLevel;
  deployment_plan: DeploymentPlan;
}

// Release Approval
export type ReleaseActionScope =
  | "DEPLOY_STAGING"
  | "DEPLOY_CANARY"
  | "PROMOTE_PRODUCTION"
  | "ROLLBACK_RELEASE";

export interface ReleaseApprovalReceipt {
  schema_version: number;
  approval_id: string;
  approver_id: string;
  approver_type: ApproverType;
  environment: EnvironmentType;
  release_candidate_id: string;
  artifact_digest: string;
  commit_sha: string;
  allowed_action: ReleaseActionScope;
  issued_at: string;
  expires_at: string;
  nonce: string;
  authentication_proof: string;
}

// Deployment Target & Plan
export interface DeploymentTarget {
  product: string;
  environment: EnvironmentType;
  service: string;
}

export interface DeploymentStep {
  step_id: string;
  name: string;
  action_type: string;
  timeout_ms: number;
}

export interface PromotionCriterion {
  metric: string;
  operator: "<=" | ">=" | "==" | "!=";
  threshold: number;
  window_seconds: number;
}

export interface RollbackCriterion {
  metric: string;
  operator: "<=" | ">=" | "==" | "!=";
  threshold: number;
}

export interface DeploymentPlan {
  plan_id: string;
  target: DeploymentTarget;
  artifact: {
    digest: string;
    immutable_tag: string;
  };
  strategy: DeploymentStrategyType;
  steps: DeploymentStep[];
  preconditions: string[];
  health_checks: string[];
  promotion_criteria: PromotionCriterion[];
  rollback_criteria: RollbackCriterion[];
  timeout_ms: number;
}

// Canary & Health Policy
export interface HealthThresholds {
  max_http_5xx_rate: number; // e.g. 0.01 (1%)
  max_latency_p95_ms: number; // e.g. 500
  max_error_count: number;
}

export interface ErrorBudget {
  allowed_5xx_count: number;
  budget_exhaustion_action: "BLOCK_PROMOTION" | "AUTO_ROLLBACK";
}

export interface CanaryPolicy {
  traffic_percentage: number;
  instance_count: number;
  observation_window_seconds: number;
  minimum_requests: number;
  health_thresholds: HealthThresholds;
  error_budget: ErrorBudget;
}

export type HealthStatus =
  | "HEALTHY"
  | "DEGRADED"
  | "UNHEALTHY"
  | "INSUFFICIENT_EVIDENCE";

export interface SignalEvaluation {
  available: boolean;
  value?: number | undefined;
  threshold?: number | undefined;
  status: "PASS" | "WARN" | "FAIL" | "MISSING";
}

export interface HealthEvaluation {
  status: HealthStatus;
  signals_evaluated: Record<string, SignalEvaluation>;
  rationale: string[];
}

// Production Verification
export interface CriticalEndpointProbe {
  endpoint: string;
  status_code: number;
  latency_ms: number;
  ok: boolean;
}

export interface ProductionVerification {
  status: "PRODUCTION_VERIFIED" | "VERIFICATION_FAILED" | "INSUFFICIENT_EVIDENCE";
  deployed_artifact_digest_match: boolean;
  commit_sha_match: boolean;
  service_health: boolean;
  critical_endpoints_probed: CriticalEndpointProbe[];
  background_processing_active: boolean;
  database_connectivity: boolean;
  cache_connectivity: boolean;
  details: string[];
}

// Rollback Plan & Known Good Release
export interface KnownGoodRelease {
  release_id: string;
  product: string;
  environment: EnvironmentType;
  artifact_digest: string;
  commit_sha: string;
  verified_at: string;
  provenance_verified: boolean;
}

export interface RollbackPlan {
  rollback_id: string;
  failed_release_id: string;
  target_release: KnownGoodRelease;
  reason: string;
  evidence: Evidence[];
  expected_state: string;
  verification_plan: string[];
}

// Final Receipts
export interface ReleaseReceipt {
  schema_version: number;
  receipt_type: "RELEASE_RECEIPT";
  release_id: string;
  product: string;
  environment: EnvironmentType;
  artifact_digest: string;
  commit_sha: string;
  deployment_id: string;
  change_plan_digest: string;
  verification_digest: string;
  apply_id: string;
  git_operation_id: string;
  ci_run_id: string;
  approval_id: string;
  deployed_at: string;
  verification_status: "PRODUCTION_VERIFIED";
  diagnostic_snapshot_before: string;
  diagnostic_snapshot_after: string;
  receipt_digest: string;
}

export interface RollbackReceipt {
  schema_version: number;
  receipt_type: "ROLLBACK_RECEIPT";
  rollback_id: string;
  failed_release_id: string;
  restored_release_id: string;
  restored_artifact_digest: string;
  reason: string;
  diagnostics_before: string;
  diagnostics_after: string;
  verification_status: "ROLLBACK_VERIFIED" | "ROLLBACK_FAILED";
  timestamp: string;
  receipt_digest: string;
}

// Audit Event Stream
export type AuditEventType =
  | "RELEASE_CREATED"
  | "CI_VERIFIED"
  | "APPROVAL_GRANTED"
  | "DEPLOY_STARTED"
  | "CANARY_STARTED"
  | "CANARY_HEALTH_CHECK"
  | "PROMOTION_APPROVED"
  | "PRODUCTION_DEPLOYED"
  | "PRODUCTION_VERIFIED"
  | "ROLLBACK_STARTED"
  | "ROLLBACK_COMPLETED"
  | "RELEASE_FAILED";

export interface ReleaseAuditEvent {
  sequence: number;
  event_type: AuditEventType;
  release_id: string;
  timestamp: string;
  detail: string;
  actor?: string | undefined;
  error?: string | undefined;
}

// Environment Registry Definition
export interface EnvironmentDefinition {
  environment_id: EnvironmentType;
  product: string;
  is_production: boolean;
  provider_name: string;
  allowed_strategies: DeploymentStrategyType[];
  requires_ci_pass: boolean;
  requires_explicit_approval: boolean;
  canary_required: boolean;
  auto_rollback_allowed: boolean;
}

// Deployment Provider Interface (Vendor-Neutral)
export interface DeploymentExecutionResult {
  deployment_id: string;
  status: "SUCCESS" | "FAILED" | "IN_PROGRESS" | "TIMEOUT";
  active_artifact_digest: string;
  message?: string | undefined;
}

export interface RollbackExecutionResult {
  rollback_id: string;
  status: "SUCCESS" | "FAILED";
  restored_digest: string;
  message?: string | undefined;
}

export interface DeploymentProvider {
  name: string;
  capabilities: DeploymentStrategyType[];
  inspect(target: DeploymentTarget): Promise<{ active_digest: string; status: string }>;
  prepare(plan: DeploymentPlan): Promise<{ ready: boolean; error?: string | undefined }>;
  deploy(plan: DeploymentPlan, scope: "CANARY" | "FULL"): Promise<DeploymentExecutionResult>;
  status(deploymentId: string): Promise<DeploymentExecutionResult>;
  rollback(plan: RollbackPlan): Promise<RollbackExecutionResult>;
}

// Safe Release Request & Result
export interface SafeReleaseRequest {
  product: string;
  environment: EnvironmentType;
  changePlan: ChangePlan;
  verificationReceipt: VerificationReceipt;
  applyReceipt: ApplyReceipt;
  gitReceipt: GitReceipt;
  ciReceipt: CIReceipt;
  artifact: ReleaseArtifact;
  approvalReceipt: ReleaseApprovalReceipt;
  promotionApprovalReceipt?: ReleaseApprovalReceipt | undefined;
  rollbackApprovalReceipt?: ReleaseApprovalReceipt | undefined;
  deploymentProvider: DeploymentProvider;
  knownGoodRelease?: KnownGoodRelease | undefined;
  customCanaryPolicy?: Partial<CanaryPolicy> | undefined;
  rawCanaryTelemetry?: {
    total_requests: number;
    error_5xx_count: number;
    p95_latency_ms: number;
    observations?: Observation[] | undefined;
  } | undefined;
  rawProductionTelemetry?: {
    service_healthy: boolean;
    db_connected: boolean;
    cache_connected: boolean;
    workers_active: boolean;
    endpoint_results?: CriticalEndpointProbe[] | undefined;
    observations?: Observation[] | undefined;
  } | undefined;
  options?: {
    simulateCrashDuringCanary?: boolean | undefined;
    autoRollbackOnFailure?: boolean | undefined;
  } | undefined;
}

export interface SafeReleaseResult {
  release_candidate_id: string;
  final_state: ReleaseState;
  release_receipt?: ReleaseReceipt | undefined;
  rollback_receipt?: RollbackReceipt | undefined;
  audit_events: ReleaseAuditEvent[];
  markdown: string;
}
