import { describe, it, expect, beforeEach } from "vitest";
import { ToolRegistry, createToolExecutionContext, McpPlatformError } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";
import { ReplayProtectionTracker } from "../src/security/replay-protection.js";
import { ApprovalSecurityValidator } from "../src/security/approval-validator.js";

describe("Engineering MCP HITL Governance for High-Risk Operations", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  beforeEach(() => {
    ReplayProtectionTracker.reset();
  });

  it("requires valid Human / Security Operator approval receipt for release rollback", () => {
    const invalidApproval = {
      approval_id: "appr_1",
      // missing signature, etc.
    };

    expect(() => {
      ApprovalSecurityValidator.validateReleaseApproval(invalidApproval as any);
    }).toThrow(McpPlatformError);
  });

  it("high-risk apply_change fails immediately when unapproved or receipt is forged", async () => {
    const forgedApproval = {
      schema_version: 1,
      approval_id: "appr_forged_1",
      approver_id: "attacker",
      approver_type: "DEV_LOCAL" as const,
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 100000).toISOString(),
      change_plan_digest: "sha256:plan",
      verification_digest: "sha256:verif",
      repository_revision: { commit_sha: "sha", tree_sha: "tree", is_dirty: false },
      workspace_id: "ws_1",
      scope: { entire_change_plan: true },
      nonce: "nonce_forged_1",
      signature_or_mac: "invalid_bad_signature",
    };

    await expect(
      registry.execute(
        "engineering_apply_change",
        {
          repository_path: process.cwd(),
          change_plan: { product: "oest", capability: "tenancy", operations: [] },
          vertical_slice_plan: { capability: "tenancy" },
          verification_receipt: { verification_digest: "sha256:verif" },
          approval_receipt: forgedApproval,
          options: {
            customSecretKey: "real_hmac_secret_key_12345",
          },
        },
        context,
      ),
    ).rejects.toThrow();
  });
});
