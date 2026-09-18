import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry, createToolExecutionContext, McpPlatformError } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";
import { ReplayProtectionTracker } from "../src/security/replay-protection.js";
import { ApprovalSecurityValidator } from "../src/security/approval-validator.js";

describe("Engineering MCP Mutation Approval Security", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  beforeEach(() => {
    ReplayProtectionTracker.reset();
  });

  it("rejects mutating apply without approval receipt", async () => {
    await expect(
      registry.execute(
        "engineering_apply_change",
        {
          repository_path: process.cwd(),
          change_plan: { product: "oest", capability: "tenancy", operations: [] },
          vertical_slice_plan: { capability: "tenancy" },
          verification_receipt: { verification_digest: "digest" },
          approval_receipt: null as any,
        },
        context,
      ),
    ).rejects.toThrow();
  });

  it("rejects expired approval receipts", () => {
    const expiredReceipt = {
      schema_version: 1,
      approval_id: "appr_expired_1",
      approver_id: "human_admin",
      approver_type: "HUMAN_OPERATOR" as const,
      approved_at: "2020-01-01T00:00:00.000Z",
      expires_at: "2020-01-01T01:00:00.000Z",
      change_plan_digest: "sha256:plan",
      verification_digest: "sha256:verif",
      repository_revision: { commit_sha: "abc", tree_sha: "def", is_dirty: false },
      workspace_id: "ws_1",
      scope: { entire_change_plan: true },
      nonce: "nonce_1",
      signature_or_mac: "sig_1",
    };

    expect(() => {
      ApprovalSecurityValidator.validateApplyApproval(expiredReceipt);
    }).toThrow(McpPlatformError);
  });

  it("rejects malformed git approval receipt", () => {
    const malformed = {
      approval_id: "appr_1",
      // missing nonce, signature, etc.
    };

    expect(() => {
      ApprovalSecurityValidator.validateGitApproval(malformed as any);
    }).toThrow(McpPlatformError);
  });
});
