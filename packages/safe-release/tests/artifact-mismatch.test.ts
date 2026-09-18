import { describe, it, expect, beforeEach } from "vitest";
import { SafeReleaseEngine } from "../src/safe-release-engine.js";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("SafeReleaseEngine — Artifact Mismatch", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
    ReleaseLock.resetAll();
  });

  it("blocks release verification when target host active artifact does not match release artifact", async () => {
    const chain = createValidTestChain();
    // Simula provider retornando digest diferente no host
    const provider = new FakeDeploymentProvider({
      mismatchDeployedArtifact: "sha256:different_unauthorized_digest_77777777777777777777777777777777"
    });

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

    const promoApproval = ReleaseApprovalFactory.createApproval({
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
      promotionApprovalReceipt: promoApproval,
      deploymentProvider: provider,
      rawCanaryTelemetry: {
        total_requests: 100,
        error_5xx_count: 0,
        p95_latency_ms: 100
      }
    });

    expect(result.final_state).toBe("PRODUCTION_UNHEALTHY");
    expect(result.release_receipt).toBeUndefined();
    expect(result.markdown).toContain("ARTIFACT_DIGEST_MISMATCH");
  });
});
