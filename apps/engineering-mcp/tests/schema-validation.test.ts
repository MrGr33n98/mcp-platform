import { describe, it, expect } from "vitest";
import { ToolRegistry, createToolExecutionContext } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";

describe("Engineering MCP Schema Validation", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  it("rejects missing repository_path on repository scanning", async () => {
    await expect(
      registry.execute("engineering_scan_repository", {}, context),
    ).rejects.toThrow();
  });

  it("rejects non-boolean workspace_mode", async () => {
    await expect(
      registry.execute(
        "engineering_scan_repository",
        { repository_path: "some/path", workspace_mode: "invalid_type" },
        context,
      ),
    ).rejects.toThrow();
  });

  it("rejects unknown risk filter on list_capabilities", async () => {
    await expect(
      registry.execute(
        "engineering_list_capabilities",
        { filter_risk: "UNKNOWN_RISK" },
        context,
      ),
    ).rejects.toThrow();
  });

  it("rejects invalid environment enum on release plan", async () => {
    await expect(
      registry.execute(
        "engineering_release_plan",
        {
          product_name: "test-prod",
          environment: "INVALID_ENV",
          artifact: {
            artifact_id: "art_1",
            artifact_type: "DOCKER_IMAGE",
            immutable_tag: "v1.0.0",
            digest: "sha256:1234",
            source_commit: "abc1234",
            build_id: "build_1",
          },
        },
        context,
      ),
    ).rejects.toThrow();
  });

  it("rejects missing branch_name on engineering_prepare_branch", async () => {
    await expect(
      registry.execute(
        "engineering_prepare_branch",
        { repository_path: "some/path" },
        context,
      ),
    ).rejects.toThrow();
  });
});
