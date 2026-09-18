import { describe, it, expect, beforeEach } from "vitest";
import { SafeReleaseEngine } from "../src/safe-release-engine.js";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";
import type { KnownGoodRelease } from "../src/types.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("SafeReleaseEngine — Canary Failure & Rollback", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
    ReleaseLock.resetAll();
  });

  it("blocks promotion when canary exhibits elevated error rates and executes controlled rollback", async () => {
    const chain = createValidTestChain();
    const provider = new FakeDeploymentProvider();

    const candidateResult = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "CANARY",
      ...chain
    });
    const candidate = candidateResult.candidate!;

    const canaryApproval = ReleaseApprovalFactory.createApproval({
      approverId: "ops-lead",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "CANARY",
      allowedAction: "DEPLOY_CANARY"
    });

    const knownGood: KnownGoodRelease = {
      release_id: "rel_oest_prev_100",
      product: "oest",
      environment: "CANARY",
      artifact_digest: "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      commit_sha: "9999999999999999999999999999999999999999",
      verified_at: new Date(Date.now() - 86400000).toISOString(),
      provenance_verified: true
    };

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
      deploymentProvider: provider,
      knownGoodRelease: knownGood,
      options: {
        autoRollbackOnFailure: true
      },
      rawCanaryTelemetry: {
        total_requests: 100,
        error_5xx_count: 15, // 15% error rate (threshold is 1%)
        p95_latency_ms: 2500 // 2500ms latency (threshold is 1000ms)
      }
    });

    expect(result.final_state).toBe("ROLLED_BACK");
    expect(result.release_receipt).toBeUndefined();
    expect(result.rollback_receipt).toBeDefined();
    expect(result.rollback_receipt?.verification_status).toBe("ROLLBACK_VERIFIED");
    expect(result.rollback_receipt?.restored_artifact_digest).toBe(knownGood.artifact_digest);
    expect(result.markdown).toContain("HTTP 5xx rate 15.00% exceeds threshold");
  });
});
