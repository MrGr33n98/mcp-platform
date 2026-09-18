import { describe, it, expect, beforeEach } from "vitest";
import { SafeReleaseEngine } from "../src/safe-release-engine.js";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("SafeReleaseEngine — Stale Approval", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
    ReleaseLock.resetAll();
  });

  it("blocks release when approval was signed for a different/stale artifact digest", async () => {
    const chain = createValidTestChain();
    const provider = new FakeDeploymentProvider();

    const candidateResult = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "CANARY",
      ...chain
    });
    const candidate = candidateResult.candidate!;

    // Cria aprovação vinculada a um digest antigo
    const staleApproval = ReleaseApprovalFactory.createApproval({
      approverId: "ops-lead",
      approverType: "HUMAN_OPERATOR",
      candidate: {
        ...candidate,
        artifact: {
          ...candidate.artifact,
          digest: "sha256:stale_old_artifact_digest_0000000000000000000000000000000000000000"
        }
      },
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
      approvalReceipt: staleApproval,
      deploymentProvider: provider
    });

    expect(result.final_state).toBe("PROMOTION_BLOCKED");
    expect(result.release_receipt).toBeUndefined();
    expect(result.markdown).toContain("APPROVAL_ARTIFACT_MISMATCH");
  });
});
