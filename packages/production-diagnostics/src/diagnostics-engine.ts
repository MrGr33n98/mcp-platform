import { LogCollector } from "./collectors/log-collector.js";
import { ErrorCollector } from "./collectors/error-collector.js";
import { MetricCollector } from "./collectors/metric-collector.js";
import { DeploymentCollector } from "./collectors/deployment-collector.js";
import { HealthCollector } from "./collectors/health-collector.js";
import { DatabaseCollector } from "./collectors/database-collector.js";
import { RedisCollector } from "./collectors/redis-collector.js";
import { SidekiqCollector } from "./collectors/sidekiq-collector.js";
import { StorageCollector } from "./collectors/storage-collector.js";
import { SymptomClassifier } from "./diagnosis/symptom-classifier.js";
import { TemporalCorrelator } from "./correlation/temporal-correlator.js";
import { DeploymentCorrelator } from "./correlation/deployment-correlator.js";
import { ArchitectureCorrelator } from "./correlation/architecture-correlator.js";
import { EvidenceChain } from "./diagnosis/evidence-chain.js";
import { HypothesisEngine } from "./diagnosis/hypothesis-engine.js";
import { DiagnosticsReportGenerator } from "./reports/diagnostics-report.js";
import { CoverageScanner } from "./discovery/coverage-scanner.js";
import type {
  DiagnosticsRequest,
  DiagnosticsResult,
  Incident,
  Observation,
  ReproductionPlan,
  ObservabilityCoverage,
} from "./types.js";

export class DiagnosticsEngine {
  public static async diagnose(request: DiagnosticsRequest): Promise<DiagnosticsResult> {
    const {
      environment,
      productName,
      architectureGraph,
      rawLogs,
      rawErrors,
      rawMetrics,
      deployments: rawDeployments,
      providers,
    } = request;

    const allObservations: Observation[] = [];
    const providerStatus: Record<string, string> = {};

    // 1. Collect Logs
    try {
      const logs = await LogCollector.collect(providers?.logProvider, rawLogs, "web", environment);
      allObservations.push(...logs);
      providerStatus["logs"] = logs.length > 0 ? "OK" : "NO_DATA";
    } catch (err) {
      providerStatus["logs"] = `ERROR: ${String(err)}`;
    }

    // 2. Collect Errors
    try {
      const errors = await ErrorCollector.collect(providers?.errorProvider, rawErrors, "web", environment);
      allObservations.push(...errors);
      providerStatus["errors"] = errors.length > 0 ? "OK" : "NO_DATA";
    } catch (err) {
      providerStatus["errors"] = `ERROR: ${String(err)}`;
    }

    // 3. Collect Metrics
    try {
      const metrics = await MetricCollector.collect(providers?.metricsProvider, rawMetrics, "web", environment);
      allObservations.push(...metrics);
      providerStatus["metrics"] = metrics.length > 0 ? "OK" : "NO_DATA";
    } catch (err) {
      providerStatus["metrics"] = `ERROR: ${String(err)}`;
    }

    // 4. Collect Deployments
    const deployments = await DeploymentCollector.collect(providers?.deploymentProvider, rawDeployments);
    providerStatus["deployments"] = deployments.length > 0 ? "OK" : "NO_DATA";

    // 5. Collect Health & Subsystems
    const health = await HealthCollector.collect();
    allObservations.push(...health);

    const dbHealth = await DatabaseCollector.collect(providers?.databaseHealthProvider, "postgres", environment);
    allObservations.push(...dbHealth);

    const redisHealth = await RedisCollector.collect(providers?.cacheHealthProvider, "redis", environment);
    allObservations.push(...redisHealth);

    const queueHealth = await SidekiqCollector.collect(providers?.queueHealthProvider, "sidekiq", environment);
    allObservations.push(...queueHealth);

    const storageHealth = await StorageCollector.collect(providers?.storageHealthProvider, "storage", environment);
    allObservations.push(...storageHealth);

    // 6. Build Timeline
    const timeline = TemporalCorrelator.buildTimeline(allObservations);

    // 7. Classify Symptoms
    const symptoms = SymptomClassifier.classify(allObservations);

    // 8. Find First Error Observation
    const firstError = allObservations
      .filter(o => o.severity === "ERROR" || o.severity === "CRITICAL")
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

    // 9. Deployment Correlation
    const deploymentCorrelation = DeploymentCorrelator.correlate(deployments, firstError);

    // 10. Affected Components & Architecture Graph Correlation
    const affectedComponentNames = Array.from(
      new Set(
        allObservations
          .filter(o => o.severity === "ERROR" || o.severity === "CRITICAL")
          .map(o => o.component)
          .filter(c => !!c && c !== "app" && c !== "infrastructure")
      )
    );

    const architectureContext = ArchitectureCorrelator.correlate(affectedComponentNames, architectureGraph);

    // 11. Immutable Evidence
    const evidence = EvidenceChain.fromObservations(allObservations);

    // 12. Hypothesis Generation with Contradicting Evidence Search
    const hypotheses = HypothesisEngine.generateHypotheses({
      symptoms,
      evidence,
      observations: allObservations,
      deploymentCorrelation,
      architectureContext,
      deployments,
    });

    // 13. Incident Record
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const primarySymptom = symptoms[0]?.type || "SYSTEM_ANOMALY";
    const incidentTitle = `${primarySymptom} in ${productName} (${environment})`;

    const incident: Incident = {
      incident_id: incidentId,
      title: incidentTitle,
      started_at: timeline.started_at,
      detected_at: timeline.detected_at,
      status: symptoms.length > 0 ? "ACTIVE" : "RESOLVED",
      symptoms,
      affected_services: Array.from(new Set(allObservations.map(o => o.service))),
      affected_components: affectedComponentNames,
      observations: allObservations,
      hypotheses,
      deployments,
      evidence,
    };

    // 14. Safe Reproduction Plan (Zero Production Mutation)
    const primaryComp = affectedComponentNames[0] || "application";
    const reproductionPlan: ReproductionPlan = {
      symptom: primarySymptom,
      candidate_component: primaryComp,
      safe_environment: "local_test_or_staging_sandbox",
      steps: [
        `Check out candidate commit revision (or current local revision).`,
        `Run candidate unit/integration tests: ${architectureContext.candidateTests.join(", ") || "bundle exec rspec"}.`,
        `Simulate failure payload matching fingerprint ${evidence[0]?.fingerprint || "none"} in isolated sandbox.`,
      ],
      expected_failure: `${primarySymptom} reproduced in isolated test fixture`,
      existing_tests: architectureContext.candidateTests,
      new_regression_test_needed: architectureContext.candidateTests.length === 0,
    };

    // 15. Observability Coverage
    const coverage: ObservabilityCoverage = {
      logs: allObservations.some(o => o.source_type === "LOG") ? "AVAILABLE" : "UNAVAILABLE",
      metrics: allObservations.some(o => o.source_type === "METRIC") ? "AVAILABLE" : "UNAVAILABLE",
      errors: allObservations.some(o => o.source_type === "ERROR_TRACKER") ? "AVAILABLE" : "UNAVAILABLE",
      deployments: deployments.length > 0 ? "AVAILABLE" : "UNAVAILABLE",
      database: allObservations.some(o => o.source_type === "DATABASE") ? "AVAILABLE" : "UNAVAILABLE",
      redis: allObservations.some(o => o.source_type === "REDIS") ? "AVAILABLE" : "UNAVAILABLE",
      jobs: allObservations.some(o => o.source_type === "SIDEKIQ") ? "AVAILABLE" : "UNAVAILABLE",
      storage: allObservations.some(o => o.source_type === "STORAGE") ? "AVAILABLE" : "UNAVAILABLE",
      traces: "UNAVAILABLE",
      configured_providers: Object.keys(providerStatus),
    };

    // 16. Snapshot, Receipt, Handoff & Markdown
    const snapshot = DiagnosticsReportGenerator.createSnapshot(
      environment,
      allObservations,
      providerStatus,
      deployments[0]?.commit_sha
    );

    const receipt = DiagnosticsReportGenerator.createReceipt(snapshot, incident);
    const handoff = DiagnosticsReportGenerator.createHandoff(incident, snapshot.digest, reproductionPlan);
    const markdown = DiagnosticsReportGenerator.generateMarkdown(
      incident,
      timeline,
      snapshot,
      receipt,
      coverage,
      reproductionPlan
    );

    return {
      incident,
      timeline,
      snapshot,
      receipt,
      handoff,
      coverage,
      markdown,
    };
  }
}
