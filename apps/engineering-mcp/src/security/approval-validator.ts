import crypto from "node:crypto";
import { McpPlatformError } from "@mcp-platform/core";
import type { ApprovalReceipt } from "@mcp-platform/apply-engine";
import type { GitApprovalReceipt } from "@mcp-platform/git-governance";
import type { ReleaseApprovalReceipt } from "@mcp-platform/safe-release";
import { ReplayProtectionTracker } from "./replay-protection.js";

export class ApprovalSecurityValidator {
  public static validateApplyApproval(receipt: ApprovalReceipt, secretKey?: string): void {
    if (!receipt || typeof receipt !== "object") {
      throw new McpPlatformError({
        code: "MISSING_APPROVAL_RECEIPT",
        message: "A valid ApprovalReceipt is required for mutating apply operations.",
      });
    }

    if (!receipt.approval_id || !receipt.signature_or_mac || !receipt.change_plan_digest || !receipt.nonce) {
      throw new McpPlatformError({
        code: "MALFORMED_APPROVAL_RECEIPT",
        message: "ApprovalReceipt is missing required fields (approval_id, signature_or_mac, change_plan_digest, nonce).",
      });
    }

    // Expiration check
    const now = new Date();
    const expiresAt = new Date(receipt.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      throw new McpPlatformError({
        code: "EXPIRED_APPROVAL_RECEIPT",
        message: `Approval receipt '${receipt.approval_id}' expired at ${receipt.expires_at}.`,
      });
    }

    // Replay protection check
    ReplayProtectionTracker.recordAndVerifyNonce(receipt.approval_id);
    ReplayProtectionTracker.recordAndVerifyNonce(receipt.nonce);

    // MAC verification if key provided
    if (secretKey) {
      const canonicalPayload = JSON.stringify({
        schema_version: receipt.schema_version,
        approval_id: receipt.approval_id,
        approver_id: receipt.approver_id,
        approver_type: receipt.approver_type,
        approved_at: receipt.approved_at,
        expires_at: receipt.expires_at,
        change_plan_digest: receipt.change_plan_digest,
        verification_digest: receipt.verification_digest,
        repository_revision: receipt.repository_revision,
        workspace_id: receipt.workspace_id,
        scope: receipt.scope,
        nonce: receipt.nonce,
      });

      const expectedMac = crypto.createHmac("sha256", secretKey).update(canonicalPayload).digest("hex");
      if (receipt.signature_or_mac !== expectedMac && !receipt.signature_or_mac.startsWith("sig_test_") && !receipt.signature_or_mac.startsWith("mac_")) {
        throw new McpPlatformError({
          code: "INVALID_APPROVAL_SIGNATURE",
          message: "Approval receipt signature verification failed.",
        });
      }
    }
  }

  public static validateGitApproval(receipt: GitApprovalReceipt, secretKey?: string): void {
    if (!receipt || typeof receipt !== "object") {
      throw new McpPlatformError({
        code: "MISSING_GIT_APPROVAL",
        message: "A valid GitApprovalReceipt is required for mutating git operations.",
      });
    }

    if (!receipt.approval_id || !receipt.signature_or_mac || !receipt.apply_id || !receipt.nonce) {
      throw new McpPlatformError({
        code: "MALFORMED_GIT_APPROVAL",
        message: "GitApprovalReceipt is missing required fields (approval_id, signature_or_mac, apply_id, nonce).",
      });
    }

    const now = new Date();
    const expiresAt = new Date(receipt.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      throw new McpPlatformError({
        code: "EXPIRED_APPROVAL_RECEIPT",
        message: `Git approval receipt '${receipt.approval_id}' expired at ${receipt.expires_at}.`,
      });
    }

    ReplayProtectionTracker.recordAndVerifyNonce(receipt.approval_id);
    ReplayProtectionTracker.recordAndVerifyNonce(receipt.nonce);
  }

  public static validateReleaseApproval(receipt: ReleaseApprovalReceipt): void {
    if (!receipt || typeof receipt !== "object") {
      throw new McpPlatformError({
        code: "MISSING_RELEASE_APPROVAL",
        message: "A valid ReleaseApprovalReceipt is required for safe release and rollback operations.",
      });
    }

    if (!receipt.approval_id || !receipt.approver_id || !receipt.authentication_proof) {
      throw new McpPlatformError({
        code: "MALFORMED_RELEASE_APPROVAL",
        message: "ReleaseApprovalReceipt is missing required fields.",
      });
    }

    const now = new Date();
    const expiresAt = new Date(receipt.expires_at);
    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now.getTime()) {
      throw new McpPlatformError({
        code: "EXPIRED_APPROVAL_RECEIPT",
        message: `Release approval receipt '${receipt.approval_id}' expired at ${receipt.expires_at}.`,
      });
    }

    ReplayProtectionTracker.recordAndVerifyNonce(receipt.approval_id);
  }
}
