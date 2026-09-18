import { createHmac } from "node:crypto";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitApprovalReceipt, GitApprovalScopeType } from "../types.js";

export interface ReceiptValidationResult {
  valid: boolean;
  errors: string[];
}

export class ApplyReceiptValidator {
  private static readonly SEEN_NONCES = new Set<string>();

  public static validate(
    applyReceipt: ApplyReceipt,
    gitApprovalReceipt: GitApprovalReceipt,
    secretOrKey: string = "mcp_platform_default_git_secret_key"
  ): ReceiptValidationResult {
    const errors: string[] = [];

    // 1. Status Check
    if (applyReceipt.status !== "APPLIED_VERIFIED") {
      errors.push(
        `ApplyReceipt status must be 'APPLIED_VERIFIED' to proceed with Git operations (got '${applyReceipt.status}').`
      );
    }

    // 2. Digest Matching
    if (applyReceipt.change_plan_digest !== gitApprovalReceipt.change_plan_digest) {
      errors.push(
        `ChangePlan digest mismatch between ApplyReceipt and GitApprovalReceipt.`
      );
    }

    if (applyReceipt.verification_digest !== gitApprovalReceipt.verification_digest) {
      errors.push(
        `Verification digest mismatch between ApplyReceipt and GitApprovalReceipt.`
      );
    }

    if (applyReceipt.apply_id !== gitApprovalReceipt.apply_id) {
      errors.push(
        `Apply ID mismatch between ApplyReceipt ('${applyReceipt.apply_id}') and GitApprovalReceipt ('${gitApprovalReceipt.apply_id}').`
      );
    }

    // 3. Expiration Check
    const expiresAt = new Date(gitApprovalReceipt.expires_at).getTime();
    const now = Date.now();
    if (isNaN(expiresAt) || now > expiresAt) {
      errors.push(`GitApprovalReceipt has expired at ${gitApprovalReceipt.expires_at}`);
    }

    // 4. Nonce Replay Check
    if (this.SEEN_NONCES.has(gitApprovalReceipt.nonce)) {
      errors.push(`GitApprovalReceipt nonce replay detected: '${gitApprovalReceipt.nonce}'`);
    } else {
      this.SEEN_NONCES.add(gitApprovalReceipt.nonce);
    }

    // 5. Signature verification
    const expectedSig = this.computeSignature(gitApprovalReceipt, secretOrKey);
    if (gitApprovalReceipt.signature_or_mac !== expectedSig) {
      errors.push("Invalid GitApprovalReceipt HMAC signature.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public static computeSignature(
    receipt: Omit<GitApprovalReceipt, "signature_or_mac">,
    secretOrKey: string
  ): string {
    const payload = [
      receipt.approval_id,
      receipt.approver_id,
      receipt.approver_type,
      receipt.approved_at,
      receipt.expires_at,
      receipt.apply_id,
      receipt.change_plan_digest,
      receipt.verification_digest,
      receipt.workspace_id,
      receipt.scope.scopes.join(","),
      receipt.nonce,
    ].join("|");

    return createHmac("sha256", secretOrKey).update(payload).digest("hex");
  }

  public static hasScope(receipt: GitApprovalReceipt, scope: GitApprovalScopeType): boolean {
    return receipt.scope.scopes.includes(scope);
  }

  public static clearNonceCacheForTesting(): void {
    this.SEEN_NONCES.clear();
  }
}
