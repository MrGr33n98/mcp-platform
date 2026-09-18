import { describe, it, expect } from "vitest";
import { ToolRegistry, createToolExecutionContext, McpPlatformError } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";
import { PathBoundaryValidator } from "../src/security/path-boundary-validator.js";

describe("Engineering MCP Repository Boundary & Security", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  it("rejects non-existent directory", async () => {
    await expect(
      registry.execute(
        "engineering_scan_repository",
        { repository_path: "C:\\non_existent_dir_12345_xyz" },
        context,
      ),
    ).rejects.toThrow(McpPlatformError);
  });

  it("rejects UNC path escapes", () => {
    expect(() => {
      PathBoundaryValidator.validateRepositoryRoot("\\\\evil-server\\malicious-share");
    }).toThrow(McpPlatformError);

    expect(() => {
      PathBoundaryValidator.validateRepositoryRoot("//evil-server/malicious-share");
    }).toThrow(McpPlatformError);
  });

  it("rejects null byte injection", () => {
    expect(() => {
      PathBoundaryValidator.validateRepositoryRoot("C:\\Users\\Bobi\\Desktop\0/etc/passwd");
    }).toThrow(McpPlatformError);
  });

  it("rejects path traversal escaping root", () => {
    const cwd = process.cwd();
    expect(() => {
      PathBoundaryValidator.validatePathWithinRoot("../../../Windows/System32", cwd);
    }).toThrow(McpPlatformError);
  });

  it("rejects access to sensitive files (SSH keys, master.key, credentials)", () => {
    const cwd = process.cwd();
    expect(() => {
      PathBoundaryValidator.validatePathWithinRoot("config/master.key", cwd);
    }).toThrow(McpPlatformError);

    expect(() => {
      PathBoundaryValidator.validatePathWithinRoot(".ssh/id_rsa", cwd);
    }).toThrow(McpPlatformError);

    expect(() => {
      PathBoundaryValidator.validatePathWithinRoot("credentials.json", cwd);
    }).toThrow(McpPlatformError);
  });
});
