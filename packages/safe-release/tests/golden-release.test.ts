import { describe, it, expect, beforeEach } from "vitest";
import { SafeReleaseEngine } from "../src/safe-release-engine.js";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("SafeReleaseEngine — Golden Release", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
    ReleaseLock.resetAll();
  });

  it("completes full Golden Canary release flow and emits valid ReleaseReceipt", async () => {
    const chain = createValidTestChain();
    const provider = new FakeDeploymentProvider();

    const candidateResult = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "CANARY",
      ...chain
    });
    expect(candidateResult.candidate).toBeDefined();
    const candidate = candidateResult.candidate!;

    const canaryApproval = ReleaseApprovalFactory.createApproval({
      approverId: "ops-lead",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "CANARY",
      allowedAction: "DEPLOY_CANARY"
    });

    const promotionApproval = ReleaseApprovalFactory.createApproval({
      approverId: "ops-lead",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "CANARY",
      allowedAction: "PROMOTE_PRODUCTION"
    });

    const result = await SafeReleaseEngine.executeRelease({
      product: "oest",
      environment: "CANARY",
      changePlan: chain.changePlan,
      verificationReceipt: chain.verificationReceipt,
      applyReceipt: chain.applyReceipt,
      gitReceipt: chain.gitReceipt,
      ciReceipt: chain.ciReceipt,
      artifact: chain.artifact,
      approvalReceipt: canaryApproval,
      promotionApprovalReceipt: promotionApproval,
      deploymentProvider: provider,
      rawCanaryTelemetry: {
        total_requests: 100,
        error_5xx_count: 0,
        p95_latency_ms: 120,
        observations: []
      },
      rawProductionTelemetry: {
        service_healthy: true,
        db_connected: true,
        cache_connected: true,
        workers_active: true
      }
    });

    expect(result.final_state).toBe("PRODUCTION_VERIFIED");
    expect(result.release_receipt).toBeDefined();
    expect(result.release_receipt?.verification_status).toBe("PRODUCTION_VERIFIED");
    expect(result.release_receipt?.artifact_digest).toBe(chain.artifact.digest);
    expect(result.markdown).toContain("Verified Release Receipt");
  });
});
