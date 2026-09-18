import { describe, it, expect } from "vitest";
import { ToolRegistry } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";
import { REGISTERED_TOOLS_METADATA } from "../src/tools/discovery-tools.js";

describe("Engineering MCP Server Contract - Tool Registration & List", () => {
  it("registers all expected V5 engineering tools", () => {
    const registry = new ToolRegistry();
    registerEngineeringTools(registry);

    const tools = registry.list();
    const toolNames = tools.map((t) => t.name).sort();

    const expectedNames = [
      "engineering_get_platform_info",
      "engineering_list_capabilities",
      "engineering_scan_repository",
      "engineering_get_repository_evidence",
      "engineering_build_architecture_graph",
      "engineering_analyze_saas_gaps",
      "engineering_plan_feature",
      "engineering_analyze_blast_radius",
      "engineering_verify_change",
      "engineering_preview_apply",
      "engineering_apply_change",
      "engineering_rollback_apply",
      "engineering_git_status",
      "engineering_prepare_branch",
      "engineering_prepare_commit",
      "engineering_diagnose_production",
      "engineering_release_plan",
      "engineering_verify_release",
      "engineering_rollback_release",
    ].sort();

    expect(toolNames).toEqual(expectedNames);
    expect(tools.length).toBe(19);
  });

  it("exposes matching metadata for each tool in capability discovery", () => {
    const registry = new ToolRegistry();
    registerEngineeringTools(registry);
    const tools = registry.list();

    for (const meta of REGISTERED_TOOLS_METADATA) {
      const registered = tools.find((t) => t.name === meta.name);
      expect(registered, `Tool ${meta.name} must be registered`).toBeDefined();
      expect(registered?.description).toBeTruthy();
      expect(registered?.inputSchema).toBeDefined();

      if (meta.risk_level === "READ" || meta.risk_level === "PLAN") {
        expect(meta.mutates_repository).toBe(false);
      }
    }
  });
});
