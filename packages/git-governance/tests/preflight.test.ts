import { describe, it, expect, beforeEach } from "vitest";
import { ApplyReceiptValidator } from "../src/preflight/apply-receipt-validator.js";
import { BranchValidator } from "../src/preflight/branch-validator.js";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitApprovalReceipt } from "../src/types.js";

describe("Pre-Flight Validators", () => {
  const secretKey = "test_secret_key";
  let validApplyReceipt: ApplyReceipt;
  let validApprovalReceipt: GitApprovalReceipt;

  beforeEach(() => {
    ApplyReceiptValidator.clearNonceCacheForTesting();

    validApplyReceipt = {
      schema_version: 1,
      receipt_type: "APPLY_RECEIPT",
      apply_id: "apply_test_123",
      change_plan_digest: "plan_digest_abc",
      verification_digest: "verif_digest_xyz",
      approval_id: "approval_apply_001",
      repository_before: {
        commitSha: "commit_before_sha",
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      applied_change_digest: "applied_change_digest_123",
      status: "APPLIED_VERIFIED",
      timestamp: new Date().toISOString(),
    };

    const receiptWithoutSig: Omit<GitApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "git_approval_999",
      approver_id: "sec_officer",
      approver_type: "SECURITY_OFFICER",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      apply_id: "apply_test_123",
      change_plan_digest: "plan_digest_abc",
      verification_digest: "verif_digest_xyz",
      repository_revision: {
        commitSha: "commit_before_sha",
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      workspace_id: "ws_001",
      scope: {
        scopes: ["CREATE_BRANCH", "STAGE", "COMMIT"],
      },
      nonce: "nonce_unique_123",
    };

    const sig = ApplyReceiptValidator.computeSignature(receiptWithoutSig, secretKey);
    validApprovalReceipt = {
      ...receiptWithoutSig,
      signature_or_mac: sig,
    };
  });

  it("passes validation with valid receipts", () => {
    const res = ApplyReceiptValidator.validate(validApplyReceipt, validApprovalReceipt, secretKey);
    expect(res.valid).toBe(true);
    expect(res.errors.length).toBe(0);
  });

  it("rejects ApplyReceipt when status is not APPLIED_VERIFIED", () => {
    const invalidReceipt = { ...validApplyReceipt, status: "APPLIED" as any };
    const res = ApplyReceiptValidator.validate(invalidReceipt, validApprovalReceipt, secretKey);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("APPLIED_VERIFIED");
  });

  it("rejects when digests do not match", () => {
    const invalidReceipt = { ...validApplyReceipt, change_plan_digest: "mismatched_plan" };
    const res = ApplyReceiptValidator.validate(invalidReceipt, validApprovalReceipt, secretKey);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes("ChangePlan digest mismatch"))).toBe(true);
  });

  it("rejects expired approval receipts", () => {
    const expiredReceipt = {
      ...validApprovalReceipt,
      expires_at: new Date(Date.now() - 1000).toISOString(),
      nonce: "nonce_expired_1",
    };
    expiredReceipt.signature_or_mac = ApplyReceiptValidator.computeSignature(expiredReceipt, secretKey);

    const res = ApplyReceiptValidator.validate(validApplyReceipt, expiredReceipt, secretKey);
    expect(res.valid).toBe(false);
    expect(res.errors.some(e => e.includes("expired"))).toBe(true);
  });

  it("detects nonce replay attacks", () => {
    const res1 = ApplyReceiptValidator.validate(validApplyReceipt, validApprovalReceipt, secretKey);
    expect(res1.valid).toBe(true);

    // Second submission with same nonce
    const res2 = ApplyReceiptValidator.validate(validApplyReceipt, validApprovalReceipt, secretKey);
    expect(res2.valid).toBe(false);
    expect(res2.errors.some(e => e.includes("nonce replay"))).toBe(true);
  });

  it("BranchValidator checks protected branches", () => {
    const checkMain = BranchValidator.validate("main");
    expect(checkMain.valid).toBe(false);
    expect(checkMain.errors[0]).toContain("protected");

    const checkMcp = BranchValidator.validate("mcp/webhooks/a1b2c3");
    expect(checkMcp.valid).toBe(true);
  });
});
