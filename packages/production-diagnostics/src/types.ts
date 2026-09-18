import type { RepositoryRevision } from "@mcp-platform/verification-engine";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";

export type ObservationSourceType =
  | "LOG"
  | "METRIC"
  | "ERROR_TRACKER"
  | "DEPLOYMENT"
  | "DATABASE"
  | "REDIS"
  | "SIDEKIQ"
  | "STORAGE"
  | "HEALTH_CHECK"
  | "HTTP_PROBE";

export type ObservationSeverity =
  | "INFO"
  | "WARN"
  | "ERROR"
  | "CRITICAL";

export interface Observation {
  id: string;
  source: string;
  source_type: ObservationSourceType;
  timestamp: string;
  severity: ObservationSeverity;
  service: string;
  environment: string;
  component: string;
  message: string;
  request_id?: string | undefined;
  trace_id?: string | undefined;
  deployment_id?: string | undefined;
  fingerprint?: string | undefined;
  attributes: Record<string, unknown>;
  raw_excerpt?: string | undefined;
}

export interface Evidence {
  evidence_id: string;
  source: string;
  timestamp: string;
  collector: string;
  locator: string;
  sanitized_excerpt: string;
  fingerprint: string;
  confidence: number;
}

export type SymptomType =
  | "HTTP_5XX_SPIKE"
  | "HTTP_4XX_SPIKE"
  | "LATENCY_SPIKE"
  | "TIMEOUT"
  | "DATABASE_CONNECTION_FAILURE"
  | "DATABASE_SLOW_QUERY"
  | "REDIS_FAILURE"
  | "QUEUE_BACKLOG"
  | "JOB_FAILURE"
  | "OOM"
  | "CPU_PRESSURE"
  | "MEMORY_PRESSURE"
  | "DISK_PRESSURE"
  | "STORAGE_FAILURE"
  | "EXTERNAL_API_FAILURE"
  | "AUTH_FAILURE"
  | "DEPLOYMENT_FAILURE";

export interface Symptom {
  type: SymptomType;
  description: string;
  severity: ObservationSeverity;
  first_seen: string;
  last_seen: string;
  count: number;
  affected_components: string[];
  evidence_ids: string[];
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ContradictingEvidence {
  description: string;
  evidence_id: string;
  relevance: string;
}

export interface RootCauseHypothesis {
  hypothesis_id: string;
  title: string;
  description: string;
  affected_components: string[];
  candidate_tests: string[];
  supporting_evidence: Evidence[];
  contradicting_evidence: ContradictingEvidence[];
  confidence: ConfidenceLevel;
  verification_steps: string[];
}

export interface TimelineEvent {
  timestamp: string;
  source: string;
  type: string;
  summary: string;
  evidence_ids: string[];
}

export interface IncidentTimeline {
  events: TimelineEvent[];
  started_at: string;
  detected_at: string;
  duration_minutes: number;
}

export interface DeploymentRecord {
  deployment_id: string;
  commit_sha: string;
  environment: string;
  started_at: string;
  finished_at?: string | undefined;
  status: "SUCCESS" | "FAILED" | "IN_PROGRESS";
  git_receipt_id?: string | undefined;
}

export interface Incident {
  incident_id: string;
  title: string;
  started_at: string;
  detected_at: string;
  status: "ACTIVE" | "MITIGATED" | "RESOLVED" | "ANALYZING";
  symptoms: Symptom[];
  affected_services: string[];
  affected_components: string[];
  observations: Observation[];
  hypotheses: RootCauseHypothesis[];
  deployments: DeploymentRecord[];
  evidence: Evidence[];
}

export interface ReproductionPlan {
  symptom: string;
  candidate_component: string;
  safe_environment: string;
  steps: string[];
  expected_failure: string;
  existing_tests: string[];
  new_regression_test_needed: boolean;
}

export interface DiagnosticSnapshot {
  snapshot_id: string;
  environment: string;
  captured_at: string;
  repository_revision?: RepositoryRevision | undefined;
  deployment_revision?: string | undefined;
  observations: Observation[];
  provider_status: Record<string, string>;
  digest: string;
}

export interface DiagnosticsReceipt {
  schema_version: number;
  receipt_type: "DIAGNOSTICS_RECEIPT";
  diagnostics_id: string;
  snapshot_digest: string;
  incident_id: string;
  environment: string;
  created_at: string;
  evidence_digest: string;
}

export interface DiagnosticHandoff {
  incident: Incident;
  snapshot_digest: string;
  hypotheses: RootCauseHypothesis[];
  affected_components: string[];
  candidate_tests: string[];
  reproduction_plan: ReproductionPlan;
  evidence: Evidence[];
}

export type CoverageStatus = "AVAILABLE" | "PARTIAL" | "UNAVAILABLE" | "NOT_VERIFIED";

export interface ObservabilityCoverage {
  logs: CoverageStatus;
  metrics: CoverageStatus;
  errors: CoverageStatus;
  deployments: CoverageStatus;
  database: CoverageStatus;
  redis: CoverageStatus;
  jobs: CoverageStatus;
  storage: CoverageStatus;
  traces: CoverageStatus;
  configured_providers: string[];
}

// Vendor-neutral Provider Interfaces
export interface LogProvider {
  name: string;
  fetchRecentLogs(limit?: number): Promise<Observation[]>;
}

export interface MetricsProvider {
  name: string;
  fetchMetrics(): Promise<Observation[]>;
}

export interface ErrorProvider {
  name: string;
  fetchRecentErrors(): Promise<Observation[]>;
}

export interface DeploymentProvider {
  name: string;
  fetchRecentDeployments(): Promise<DeploymentRecord[]>;
}

export interface DatabaseHealthProvider {
  name: string;
  fetchDatabaseHealth(): Promise<Observation[]>;
}

export interface CacheHealthProvider {
  name: string;
  fetchCacheHealth(): Promise<Observation[]>;
}

export interface QueueHealthProvider {
  name: string;
  fetchQueueHealth(): Promise<Observation[]>;
}

export interface StorageHealthProvider {
  name: string;
  fetchStorageHealth(): Promise<Observation[]>;
}

export interface DiagnosticsRequest {
  environment: string;
  productName: string;
  architectureGraph?: ArchitectureGraphData | undefined;
  rawLogs?: string[] | undefined;
  rawErrors?: Record<string, unknown>[] | undefined;
  rawMetrics?: Record<string, unknown>[] | undefined;
  deployments?: DeploymentRecord[] | undefined;
  providers?: {
    logProvider?: LogProvider | undefined;
    metricsProvider?: MetricsProvider | undefined;
    errorProvider?: ErrorProvider | undefined;
    deploymentProvider?: DeploymentProvider | undefined;
    databaseHealthProvider?: DatabaseHealthProvider | undefined;
    cacheHealthProvider?: CacheHealthProvider | undefined;
    queueHealthProvider?: QueueHealthProvider | undefined;
    storageHealthProvider?: StorageHealthProvider | undefined;
  } | undefined;
  options?: {
    timeWindowMinutes?: number | undefined;
  } | undefined;
}

export interface DiagnosticsResult {
  incident: Incident;
  timeline: IncidentTimeline;
  snapshot: DiagnosticSnapshot;
  receipt: DiagnosticsReceipt;
  handoff: DiagnosticHandoff;
  coverage: ObservabilityCoverage;
  markdown: string;
}
