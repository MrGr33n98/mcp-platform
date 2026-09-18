import { createHmac } from "crypto";
import type { ApprovalReceipt, ApprovalScope } from "../types.js";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import type { ChangePlan } from "@mcp-platform/feature-engineering";

export class ReceiptChainValidator {
  public static readonly DEFAULT_DEV_KEY = "DEV_LOCAL_SIGNING_SECRET_MCP_PLATFORM_KEY";

  public static computeApprovalSignature(
    data: Omit<ApprovalReceipt, "signature_or_mac">,
    secret: string = this.DEFAULT_DEV_KEY
  ): string {
    const payload = [
      data.schema_version,
      data.approval_id,
      data.approver_id,
      data.approver_type,
      data.approved_at,
      data.expires_at,
      data.change_plan_digest,
      data.verification_digest,
      data.repository_revision.commitSha,
      data.workspace_id,
      JSON.stringify(data.scope),
      data.nonce
    ].join("::");

    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  public static validate(params: {
    changePlan: ChangePlan;
    calculatedPlanDigest: string;
    verificationReceipt: VerificationReceipt;
    approvalReceipt: ApprovalReceipt;
    secretKey?: string | undefined;
    currentTime?: Date | undefined;
  }): { valid: boolean; reason?: string | undefined } {
    const now = params.currentTime || new Date();
    const secret = params.secretKey || this.DEFAULT_DEV_KEY;

    // 1. Validate Verification Receipt
    if (!params.verificationReceipt) {
      return { valid: false, reason: "NO VERIFICATION RECEIPT → NO APPLY." };
    }

    if (params.verificationReceipt.receipt_type !== "VERIFICATION_RECEIPT") {
      return { valid: false, reason: "Invalid receipt type for verification." };
    }

    if (params.verificationReceipt.verification_status !== "PASS") {
      return {
        valid: false,
        reason: `Verification status is '${params.verificationReceipt.verification_status}'. Only 'PASS' authorizes writes (CONDITIONAL_PASS != write authority).`
      };
    }

    if (params.verificationReceipt.change_plan_digest !== params.calculatedPlanDigest) {
      return {
        valid: false,
        reason: `VerificationReceipt change_plan_digest '${params.verificationReceipt.change_plan_digest}' does not match calculated plan digest '${params.calculatedPlanDigest}'.`
      };
    }

    // 2. Validate Approval Receipt
    if (!params.approvalReceipt) {
      return { valid: false, reason: "NO APPROVAL RECEIPT → NO APPLY." };
    }

    if (params.approvalReceipt.schema_version !== 1) {
      return { valid: false, reason: `Unsupported ApprovalReceipt schema version: ${params.approvalReceipt.schema_version}` };
    }

    // Expiration check
    const expiresAt = new Date(params.approvalReceipt.expires_at);
    if (isNaN(expiresAt.getTime()) || now.getTime() > expiresAt.getTime()) {
      return { valid: false, reason: `ApprovalReceipt has EXPIRED at ${params.approvalReceipt.expires_at} (current: ${now.toISOString()}).` };
    }

    // Nonce check
    if (!params.approvalReceipt.nonce || params.approvalReceipt.nonce.length < 8) {
      return { valid: false, reason: "ApprovalReceipt missing or invalid replay-protection nonce." };
    }

    // Plan & Verification link matching
    if (params.approvalReceipt.change_plan_digest !== params.calculatedPlanDigest) {
      return {
        valid: false,
        reason: `ApprovalReceipt plan digest '${params.approvalReceipt.change_plan_digest}' does not match plan digest '${params.calculatedPlanDigest}'.`
      };
    }

    if (params.approvalReceipt.verification_digest !== params.verificationReceipt.verification_digest) {
      return {
        valid: false,
        reason: `ApprovalReceipt verification digest '${params.approvalReceipt.verification_digest}' does not match VerificationReceipt digest '${params.verificationReceipt.verification_digest}'.`
      };
    }

    // Cryptographic signature check (HMAC-SHA256 for DEV_LOCAL / HMAC)
    const expectedSig = this.computeApprovalSignature(params.approvalReceipt, secret);
    if (params.approvalReceipt.signature_or_mac !== expectedSig) {
      return {
        valid: false,
        reason: "ApprovalReceipt signature or MAC is INVALID or forged."
      };
    }

    // 3. Scope validation
    const scope: ApprovalScope = params.approvalReceipt.scope;
    if (!scope.entire_change_plan) {
      if (!scope.operations || scope.operations.length === 0) {
        return { valid: false, reason: "Approval scope specifies neither entire_change_plan nor specific operations." };
      }
      const planOpIds = params.changePlan.operations.map(op => op.id);
      const unapprovedOps = planOpIds.filter(id => !scope.operations!.includes(id));
      if (unapprovedOps.length > 0) {
        return {
          valid: false,
          reason: `Approval scope only authorizes [${scope.operations.join(", ")}], but ChangePlan requires [${unapprovedOps.join(", ")}]. Scope mismatch.`
        };
      }
    }

    return { valid: true };
  }
}
