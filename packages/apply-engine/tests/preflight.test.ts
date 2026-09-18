import { describe, it, expect } from "vitest";
import { ReceiptChainValidator } from "../src/preflight/receipt-validator.js";
import { RevisionValidator } from "../src/preflight/revision-validator.js";
import { DirtyTreeValidator } from "../src/preflight/dirty-tree-validator.js";
import type { ApprovalReceipt } from "../src/types.js";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import type { ChangePlan } from "@mcp-platform/feature-engineering";

describe("Preflight & Receipt Chain Validation (Phase 5G)", () => {
  const samplePlan: ChangePlan = {
    schema_version: 1,
    mode: "PLAN_ONLY",
    product: "oest",
    capability: "webhooks",
    operations: [
      { id: "OP-001", type: "CREATE_FILE", path: "app/models/webhook.rb", description: "Model", patternApplied: "ApplicationRecord" }
    ],
    verification: [],
    rollback: [],
    approval_required: true
  };

  const samplePlanDigest = "e09a968b3b30875517bfaef31d910087a7eea9d8a6bbe624cbe225e324555eee";
  const sampleVerifDigest = "24bc57aba12435cabae1e8136d4dbe22546cd44a4ad46033f70bdb6cd2655ae8";

  const sampleRevision = {
    commitSha: "8326d3538a2f1234567890abcdef1234567890ab",
    branch: "main",
    dirty: false,
    capturedAt: new Date().toISOString()
  };

  const sampleVerifReceipt: VerificationReceipt = {
    schema_version: 1,
    receipt_type: "VERIFICATION_RECEIPT",
    verification_id: "VERIF-12345",
    change_plan_digest: samplePlanDigest,
    repository_revision: sampleRevision,
    verification_status: "PASS",
    verification_digest: sampleVerifDigest,
    timestamp: new Date().toISOString()
  };

  const baseApprovalData: Omit<ApprovalReceipt, "signature_or_mac"> = {
    schema_version: 1,
    approval_id: "APPR-9999",
    approver_id: "user_architect_1",
    approver_type: "HUMAN_OPERATOR",
    approved_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    change_plan_digest: samplePlanDigest,
    verification_digest: sampleVerifDigest,
    repository_revision: sampleRevision,
    workspace_id: "workspace_oest",
    scope: { entire_change_plan: true },
    nonce: "nonce_12345678_secure"
  };

  const validSignature = ReceiptChainValidator.computeApprovalSignature(baseApprovalData);
  const sampleApprovalReceipt: ApprovalReceipt = {
    ...baseApprovalData,
    signature_or_mac: validSignature
  };

  it("authorizes execution when all receipts in chain are valid and matching", () => {
    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: sampleVerifReceipt,
      approvalReceipt: sampleApprovalReceipt
    });

    expect(result.valid).toBe(true);
  });

  it("rejects when VerificationReceipt is missing (NO VERIFICATION RECEIPT → NO APPLY)", () => {
    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: null as any,
      approvalReceipt: sampleApprovalReceipt
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("NO VERIFICATION RECEIPT → NO APPLY");
  });

  it("rejects when VerificationReceipt is CONDITIONAL_PASS (CONDITIONAL_PASS != write authority)", () => {
    const conditionalReceipt: VerificationReceipt = {
      ...sampleVerifReceipt,
      verification_status: "CONDITIONAL_PASS"
    };

    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: conditionalReceipt,
      approvalReceipt: sampleApprovalReceipt
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("CONDITIONAL_PASS != write authority");
  });

  it("rejects when ApprovalReceipt is expired (STALE APPROVAL → NO APPLY)", () => {
    const expiredApproval: ApprovalReceipt = {
      ...sampleApprovalReceipt,
      expires_at: new Date(Date.now() - 1000).toISOString()
    };
    // Recompute signature for the expired payload
    expiredApproval.signature_or_mac = ReceiptChainValidator.computeApprovalSignature(expiredApproval);

    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: sampleVerifReceipt,
      approvalReceipt: expiredApproval
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("EXPIRED");
  });

  it("rejects when ApprovalReceipt signature is forged or invalid", () => {
    const forgedApproval: ApprovalReceipt = {
      ...sampleApprovalReceipt,
      signature_or_mac: "forged_invalid_signature_hex"
    };

    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: sampleVerifReceipt,
      approvalReceipt: forgedApproval
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("signature or MAC is INVALID");
  });

  it("rejects when ApprovalReceipt scope does not cover all plan operations", () => {
    const restrictedApprovalData = {
      ...baseApprovalData,
      scope: { entire_change_plan: false, operations: ["OP-999"] }
    };
    const restrictedApproval: ApprovalReceipt = {
      ...restrictedApprovalData,
      signature_or_mac: ReceiptChainValidator.computeApprovalSignature(restrictedApprovalData)
    };

    const result = ReceiptChainValidator.validate({
      changePlan: samplePlan,
      calculatedPlanDigest: samplePlanDigest,
      verificationReceipt: sampleVerifReceipt,
      approvalReceipt: restrictedApproval
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Scope mismatch");
  });

  it("rejects when Git commit changed since verification (REPOSITORY CHANGED → NO APPLY)", () => {
    const currentDiffRevision = {
      ...sampleRevision,
      commitSha: "9999999999999999999999999999999999999999"
    };

    const result = RevisionValidator.validate({
      workspaceRoot: process.cwd(),
      expectedRevision: sampleRevision,
      customCurrentRevision: currentDiffRevision
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("REPOSITORY CHANGED (TOCTOU Detected)");
  });
});
