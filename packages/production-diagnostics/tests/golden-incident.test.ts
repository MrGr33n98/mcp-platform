import { describe, it, expect } from "vitest";
import { DiagnosticsEngine } from "../src/diagnostics-engine.js";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";

describe("Golden Incident Diagnostics Test", () => {
  const mockGraph: ArchitectureGraphData = {
    graphVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes: [
      {
        id: "node_ctrl",
        type: "CONTROLLER",
        name: "Api::V1::WebhooksController",
        file: "app/controllers/api/v1/webhooks_controller.rb",
      },
      {
        id: "node_job",
        type: "JOB",
        name: "WebhookDeliveryJob",
        file: "app/jobs/webhook_delivery_job.rb",
      },
      {
        id: "node_spec",
        type: "TEST_SPEC",
        name: "WebhooksSpec",
        file: "spec/requests/api/v1/webhooks_spec.rb",
      },
    ],
    edges: [
      {
        edgeId: "edge_1",
        source: "node_ctrl",
        target: "node_job",
        type: "ENQUEUES",
        confidence: "HIGH",
        evidence: { file: "app/controllers/api/v1/webhooks_controller.rb", reason: "Enqueues job" },
      },
      {
        edgeId: "edge_2",
        source: "node_spec",
        target: "node_ctrl",
        type: "TESTS",
        confidence: "HIGH",
        evidence: { file: "spec/requests/api/v1/webhooks_spec.rb", reason: "Tests controller" },
      },
    ],
  };

  it("produces deterministic timeline, symptoms, deployment correlation, and root cause hypothesis", async () => {
    const rawLogs = [
      `{"timestamp":"2026-09-17T20:05:00Z","level":"ERROR","message":"NoMethodError: undefined method 'deliver_now' for nil:NilClass","component":"Api::V1::WebhooksController","request_id":"req_001"}`,
      `{"timestamp":"2026-09-17T20:06:00Z","level":"ERROR","message":"Sidekiq Job failed: WebhookDeliveryJob retry limit exceeded","component":"WebhookDeliveryJob","request_id":"req_001"}`,
    ];

    const rawDeployments = [
      {
        deployment_id: "deploy_v12_canary",
        commit_sha: "a81c29e4b5c4d3e9f1a8b2c3d4e5f6a7b8c9d0e1",
        environment: "production",
        started_at: "2026-09-17T20:00:00Z",
        finished_at: "2026-09-17T20:02:00Z",
        status: "SUCCESS" as const,
      },
    ];

    const result = await DiagnosticsEngine.diagnose({
      environment: "production",
      productName: "oest",
      architectureGraph: mockGraph,
      rawLogs,
      deployments: rawDeployments,
      providers: {
        databaseHealthProvider: {
          name: "PostgreSQL",
          fetchDatabaseHealth: async () => [
            {
              id: "db_ok",
              source: "postgres",
              source_type: "DATABASE",
              timestamp: "2026-09-17T20:05:30Z",
              severity: "INFO",
              service: "postgres",
              environment: "production",
              component: "database",
              message: "Database connections healthy (pool=5/20)",
              attributes: {},
            },
          ],
        },
      },
    });

    // 1. Symptoms
    expect(result.incident.symptoms.length).toBeGreaterThan(0);
    expect(result.incident.symptoms.some(s => s.type === "HTTP_5XX_SPIKE")).toBe(true);
    expect(result.incident.symptoms.some(s => s.type === "JOB_FAILURE")).toBe(true);

    // 2. Timeline
    expect(result.timeline.events.length).toBeGreaterThanOrEqual(2);

    // 3. Deployment Correlation
    const deployHyp = result.incident.hypotheses.find(h => h.hypothesis_id.includes("deploy_v12_canary"));
    expect(deployHyp).toBeDefined();
    expect(deployHyp?.confidence).toBe("HIGH");

    // 4. Architecture Graph correlation
    expect(deployHyp?.affected_components).toContain("Api::V1::WebhooksController");
    expect(deployHyp?.candidate_tests).toContain("spec/requests/api/v1/webhooks_spec.rb");

    // 5. Reproduction Plan
    expect(result.handoff.reproduction_plan.existing_tests).toContain("spec/requests/api/v1/webhooks_spec.rb");
    expect(result.handoff.reproduction_plan.safe_environment).toBe("local_test_or_staging_sandbox");

    // 6. Receipts
    expect(result.receipt.receipt_type).toBe("DIAGNOSTICS_RECEIPT");
    expect(result.receipt.snapshot_digest).toBe(result.snapshot.digest);
  });
});
