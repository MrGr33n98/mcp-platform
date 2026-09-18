import { describe, it, expect, beforeEach } from "vitest";
import { ReplayProtectionTracker } from "../src/security/replay-protection.js";
import { ApprovalSecurityValidator } from "../src/security/approval-validator.js";
import { McpPlatformError } from "@mcp-platform/core";

describe("Engineering MCP Replay Protection", () => {
  beforeEach(() => {
    ReplayProtectionTracker.reset();
  });

  it("records nonce on first use and rejects identical nonce on replay", () => {
    ReplayProtectionTracker.recordAndVerifyNonce("nonce_abc_123");

    expect(() => {
      ReplayProtectionTracker.recordAndVerifyNonce("nonce_abc_123");
    }).toThrow(McpPlatformError);
  });

  it("rejects replaying the same approval receipt in ApprovalSecurityValidator", () => {
    const validReceipt = {
      schema_version: 1,
      approval_id: "appr_replay_test",
      approver_id: "sec_officer",
      approver_type: "SECURITY_OFFICER" as const,
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 100000).toISOString(),
      change_plan_digest: "sha256:plan",
      verification_digest: "sha256:verif",
      repository_revision: { commit_sha: "sha", tree_sha: "tree", is_dirty: false },
      workspace_id: "ws_1",
      scope: { entire_change_plan: true },
      nonce: "nonce_unique_1",
      signature_or_mac: "sig_test_1",
    };

    // First validation passes
    ApprovalSecurityValidator.validateApplyApproval(validReceipt);

    // Second validation with same receipt fails due to replay detection
    expect(() => {
      ApprovalSecurityValidator.validateApplyApproval(validReceipt);
    }).toThrow(McpPlatformError);
  });
});
