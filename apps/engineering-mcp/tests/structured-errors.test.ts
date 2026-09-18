import { describe, it, expect } from "vitest";
import {
  executeToolCall,
  loadConfig,
  ConsoleLogger,
  ConsoleAuditSink,
  ToolRegistry,
} from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";

describe("Engineering MCP Structured Error Handling", () => {
  const config = loadConfig({
    MCP_PRODUCT_ID: "engineering",
    MCP_PRODUCT_NAME: "Engineering Platform",
    MCP_LOG_LEVEL: "error",
    MCP_VERSION: "0.1.0",
  });
  const logger = new ConsoleLogger("error");
  const auditSink = new ConsoleAuditSink();
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);

  it("maps engine error into MCP structured error format", async () => {
    const result = await executeToolCall({
      config,
      registry,
      logger,
      auditSink,
      toolName: "engineering_scan_repository",
      rawInput: { repository_path: "C:\\invalid_fake_path_12345" },
    });

    expect(result.isError).toBe(true);
    const parsed = JSON.parse(result.text);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.code).toBe("INVALID_REPOSITORY_ROOT");
    expect(parsed.error.message).toBeDefined();
    expect(parsed.error.request_id).toBeDefined();
  });
});
