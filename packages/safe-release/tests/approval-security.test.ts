import { describe, it, expect, beforeEach } from "vitest";
import { ReleaseApprovalFactory } from "../src/approvals/release-approval.js";
import { ReleaseApprovalValidator } from "../src/approvals/release-approval-validator.js";
import { ReleaseCandidateBuilder } from "../src/candidate/release-candidate-builder.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("ReleaseApprovalValidator", () => {
  beforeEach(() => {
    ReleaseApprovalValidator.resetNonceRegistry();
  });

  it("validates a legitimate single-use approval receipt", () => {
    const chain = createValidTestChain();
    const candidate = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "CANARY",
      ...chain
    }).candidate!;

    const approval = ReleaseApprovalFactory.createApproval({
      approverId: "sec-admin-01",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "CANARY",
      allowedAction: "DEPLOY_CANARY"
    });

    const result = ReleaseApprovalValidator.validate({
      approval,
      candidate,
      expectedEnvironment: "CANARY",
      requiredAction: "DEPLOY_CANARY"
    });

    expect(result.valid).toBe(true);
  });

  it("detects and blocks replay attacks when a nonce is consumed twice", () => {
    const chain = createValidTestChain();
    const candidate = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "CANARY",
      ...chain
    }).candidate!;

    const approval = ReleaseApprovalFactory.createApproval({
      approverId: "sec-admin-01",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "CANARY",
      allowedAction: "DEPLOY_CANARY"
    });

    ReleaseApprovalValidator.consumeNonce(approval.nonce);

    const result = ReleaseApprovalValidator.validate({
      approval,
      candidate,
      expectedEnvironment: "CANARY",
      requiredAction: "DEPLOY_CANARY"
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("APPROVAL_REPLAY_DETECTED");
  });

  it("enforces approval boundary: DEPLOY_CANARY does NOT authorize PROMOTE_PRODUCTION", () => {
    const chain = createValidTestChain();
    const candidate = ReleaseCandidateBuilder.build({
      product: "oest",
      environment: "PRODUCTION",
      ...chain
    }).candidate!;

    const canaryApproval = ReleaseApprovalFactory.createApproval({
      approverId: "sec-admin-01",
      approverType: "HUMAN_OPERATOR",
      candidate,
      environment: "PRODUCTION",
      allowedAction: "DEPLOY_CANARY"
    });

    const result = ReleaseApprovalValidator.validate({
      approval: canaryApproval,
      candidate,
      expectedEnvironment: "PRODUCTION",
      requiredAction: "PROMOTE_PRODUCTION"
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("APPROVAL_SCOPE_MISMATCH");
  });
});
