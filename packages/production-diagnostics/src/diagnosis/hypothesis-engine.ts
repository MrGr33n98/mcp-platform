import type {
  Evidence,
  Symptom,
  DeploymentRecord,
  RootCauseHypothesis,
  ContradictingEvidence,
  Observation,
} from "../types.js";
import type { RuntimeArchitectureContext } from "../correlation/architecture-correlator.js";
import type { DeploymentCorrelationResult } from "../correlation/deployment-correlator.js";
import { ConfidenceEngine } from "./confidence-engine.js";

export class HypothesisEngine {
  public static generateHypotheses(params: {
    symptoms: Symptom[];
    evidence: Evidence[];
    observations: Observation[];
    deploymentCorrelation: DeploymentCorrelationResult;
    architectureContext: RuntimeArchitectureContext;
    deployments: DeploymentRecord[];
  }): RootCauseHypothesis[] {
    const { symptoms, evidence, observations, deploymentCorrelation, architectureContext } = params;
    const hypotheses: RootCauseHypothesis[] = [];

    const hasExternalFailure = symptoms.some(s => s.type === "EXTERNAL_API_FAILURE");
    const hasDbFailure = symptoms.some(s => s.type === "DATABASE_CONNECTION_FAILURE");
    const hasJobFailure = symptoms.some(s => s.type === "JOB_FAILURE");
    const hasHttp5xx = symptoms.some(s => s.type === "HTTP_5XX_SPIKE");

    // Check DB health observations
    const dbHealthyObs = observations.find(
      o => o.source_type === "DATABASE" && (o.message.toLowerCase().includes("healthy") || o.severity === "INFO")
    );

    // 1. External API Outage Hypothesis
    if (hasExternalFailure) {
      const extEvidence = evidence.filter(e => e.sanitized_excerpt.toLowerCase().includes("external") || e.sanitized_excerpt.toLowerCase().includes("stripe") || e.sanitized_excerpt.toLowerCase().includes("timeout"));
      const contradicting: ContradictingEvidence[] = [];

      hypotheses.push({
        hypothesis_id: "hyp_external_dependency_outage",
        title: "Upstream External API Outage / High Latency",
        description: "An external third-party API dependency is failing or timing out, causing downstream request failures.",
        affected_components: ["external_api", ...architectureContext.matchedNodes.map(n => n.name)],
        candidate_tests: architectureContext.candidateTests,
        supporting_evidence: extEvidence,
        contradicting_evidence: contradicting,
        confidence: extEvidence.length > 0 ? "HIGH" : "MEDIUM",
        verification_steps: [
          "Check third-party vendor status page and network connectivity.",
          "Verify timeout and circuit breaker configurations in the service layer.",
        ],
      });
    }

    // 2. Deployment Regression Hypothesis
    if (deploymentCorrelation.isTemporallyCorrelated && deploymentCorrelation.correlatedDeployment) {
      const deploy = deploymentCorrelation.correlatedDeployment;
      const supporting = evidence.filter(e => new Date(e.timestamp).getTime() >= new Date(deploy.started_at).getTime());
      const contradicting: ContradictingEvidence[] = [];

      // Check if external outage contradicts deployment causality
      if (hasExternalFailure) {
        contradicting.push({
          description: "External API dependency failure was detected concurrently, which may be the true root cause rather than code changes in the deployment.",
          evidence_id: "ev_external_outage_concurrency",
          relevance: "Alternative primary cause",
        });
      }

      const isDirectMatch = architectureContext.matchedNodes.length > 0;
      const confidence = ConfidenceEngine.calculateConfidence(supporting.length, contradicting.length, isDirectMatch);

      hypotheses.push({
        hypothesis_id: `hyp_deployment_regression_${deploy.deployment_id}`,
        title: `Code Regression Introduced in Deployment ${deploy.deployment_id}`,
        description: `Deployment ${deploy.deployment_id} (commit ${deploy.commit_sha.substring(0, 8)}) is temporally correlated with the onset of errors.`,
        affected_components: architectureContext.matchedNodes.map(n => n.name),
        candidate_tests: architectureContext.candidateTests,
        supporting_evidence: supporting,
        contradicting_evidence: contradicting,
        confidence,
        verification_steps: [
          `Review git diff of commit ${deploy.commit_sha}.`,
          `Execute candidate tests: ${architectureContext.candidateTests.join(", ") || "None found"}.`,
          "Simulate rollback in staging environment if symptom severity is CRITICAL.",
        ],
      });
    }

    // 3. Database Outage Hypothesis
    if (hasDbFailure) {
      const dbEvidence = evidence.filter(e => e.sanitized_excerpt.toLowerCase().includes("database") || e.sanitized_excerpt.toLowerCase().includes("pg::"));
      const contradicting: ContradictingEvidence[] = [];

      if (dbHealthyObs) {
        contradicting.push({
          description: `Direct database health check reported healthy status (${dbHealthyObs.message}).`,
          evidence_id: dbHealthyObs.id,
          relevance: "Direct probe contradicts complete outage",
        });
      }

      hypotheses.push({
        hypothesis_id: "hyp_database_exhaustion",
        title: "Database Connection Pool Exhaustion or High Latency",
        description: "Application processes are unable to obtain database connections or queries are timing out.",
        affected_components: ["database", "connection_pool"],
        candidate_tests: [],
        supporting_evidence: dbEvidence,
        contradicting_evidence: contradicting,
        confidence: contradicting.length > 0 ? "LOW" : "HIGH",
        verification_steps: [
          "Inspect pg_stat_activity for locked connections.",
          "Check database connection pool configuration against max worker threads.",
        ],
      });
    }

    // 4. Default Fallback Hypothesis if no specific hypothesis triggered
    if (hypotheses.length === 0 && (hasHttp5xx || hasJobFailure)) {
      hypotheses.push({
        hypothesis_id: "hyp_runtime_exception",
        title: "Unhandled Application Runtime Exception",
        description: "Exceptions in core application logic during request handling or job processing.",
        affected_components: architectureContext.matchedNodes.map(n => n.name),
        candidate_tests: architectureContext.candidateTests,
        supporting_evidence: evidence,
        contradicting_evidence: [],
        confidence: "MEDIUM",
        verification_steps: [
          "Inspect exception stack traces in logs.",
          "Run candidate tests to reproduce error in local test environment.",
        ],
      });
    }

    return hypotheses;
  }
}
