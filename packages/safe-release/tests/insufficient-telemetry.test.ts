import { describe, it, expect, beforeEach } from "vitest";
import { SafeReleaseEngine } from "../src/safe-release-engine.js";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("SafeReleaseEngine — Insufficient Telemetry", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
    ReleaseLock.resetAll();
  });

  it("blocks promotion when telemetry is missing (absence of errors != healthy)", async () => {
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
      // Telemetria omitida ou vazia
      rawCanaryTelemetry: undefined
    });

    expect(result.final_state).toBe("CANARY_FAILED");
    expect(result.release_receipt).toBeUndefined();
    expect(result.markdown).toContain("INSUFFICIENT_EVIDENCE: No telemetry signals");
  });
});
