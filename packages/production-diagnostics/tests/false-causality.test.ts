import { describe, it, expect } from "vitest";
import { DiagnosticsEngine } from "../src/diagnostics-engine.js";

describe("False Causality Prevention Test", () => {
  it("does not blindly blame deployment when external provider outage is the true cause", async () => {
    const rawDeployments = [
      {
        deployment_id: "deploy_minor_fix",
        commit_sha: "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0",
        environment: "production",
        started_at: "2026-09-17T10:00:00Z",
        finished_at: "2026-09-17T10:01:00Z",
        status: "SUCCESS" as const,
      },
    ];

    const rawLogs = [
      `{"timestamp":"2026-09-17T10:01:30Z","level":"ERROR","message":"External API Gateway returned 503 Service Unavailable for Stripe API","component":"PaymentGateway","request_id":"req_ext_1"}`,
      `{"timestamp":"2026-09-17T10:02:00Z","level":"ERROR","message":"Net::ReadTimeout: Timeout connecting to upstream external api","component":"PaymentService","request_id":"req_ext_1"}`,
    ];

    const result = await DiagnosticsEngine.diagnose({
      environment: "production",
      productName: "oest",
      rawLogs,
      deployments: rawDeployments,
    });

    // 1. Check external API hypothesis exists and has high confidence
    const extHyp = result.incident.hypotheses.find(h => h.hypothesis_id === "hyp_external_dependency_outage");
    expect(extHyp).toBeDefined();
    expect(extHyp?.confidence).toBe("HIGH");

    // 2. Check deployment hypothesis has contradicting evidence recorded
    const deployHyp = result.incident.hypotheses.find(h => h.hypothesis_id.includes("deploy_minor_fix"));
    expect(deployHyp).toBeDefined();
    expect(deployHyp?.contradicting_evidence.length).toBeGreaterThan(0);
    expect(deployHyp?.contradicting_evidence[0]?.description).toContain("External API dependency failure");
    expect(deployHyp?.confidence).toBe("LOW");
  });
});
