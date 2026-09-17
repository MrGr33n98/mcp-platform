import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { AuditEvent, AuditSink } from "../src/audit/audit-sink.js";
import { loadConfig } from "../src/config/load-config.js";
import {
  createToolExecutionContext,
  generateRequestId,
} from "../src/context/tool-execution-context.js";
import { McpPlatformError } from "../src/errors/mcp-platform-error.js";
import { normalizeError } from "../src/errors/normalize-error.js";
import { ConsoleLogger, type Logger } from "../src/logging/logger.js";
import { redactSecrets, redactString } from "../src/logging/redaction.js";
import { ToolRegistry } from "../src/registry/tool-registry.js";
import { executeToolCall } from "../src/server/create-mcp-server.js";
import { emptyObjectSchema } from "../src/schemas/common.js";
import { createPlatformInfoTool } from "../src/tools/platform-info.js";
import type { ToolDefinition } from "../src/tools/tool-definition.js";

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

class RecordingAuditSink implements AuditSink {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function createValidTool(name = "get_alpha"): ToolDefinition<typeof emptyObjectSchema> {
  return {
    name,
    description: "A valid read-only test tool.",
    readOnly: true,
    inputSchema: emptyObjectSchema,
    execute() {
      return { ok: true };
    },
  };
}

function createConfig() {
  return loadConfig({
    MCP_PRODUCT_ID: "platform-smoke",
    MCP_PRODUCT_NAME: "MCP Platform Smoke",
    MCP_VERSION: "0.1.0-test",
  });
}

describe("ToolRegistry", () => {
  it("registers a valid read-only tool", () => {
    const registry = new ToolRegistry();
    registry.register(createValidTool());

    expect(registry.has("get_alpha")).toBe(true);
    expect(registry.get("get_alpha")?.name).toBe("get_alpha");
  });

  it("rejects duplicate tools", () => {
    const registry = new ToolRegistry();
    registry.register(createValidTool());

    expect(() => registry.register(createValidTool())).toThrowError(
      McpPlatformError,
    );
  });

  it("rejects mutation tools", () => {
    const registry = new ToolRegistry();
    const mutation = {
      ...createValidTool("delete_alpha"),
      readOnly: false,
    } as ToolDefinition;

    expect(() => registry.register(mutation)).toThrowError(McpPlatformError);
  });

  it("rejects invalid tool names", () => {
    const registry = new ToolRegistry();

    expect(() => registry.register(createValidTool("Get Alpha"))).toThrowError(
      McpPlatformError,
    );
  });

  it("rejects empty descriptions", () => {
    const registry = new ToolRegistry();
    const tool = { ...createValidTool(), description: "   " };

    expect(() => registry.register(tool)).toThrowError(McpPlatformError);
  });

  it("rejects a missing schema at runtime", () => {
    const registry = new ToolRegistry();
    const malformedTool = {
      name: "get_missing_schema",
      description: "Malformed tool for validation coverage.",
      readOnly: true,
      execute() {
        return { ok: true };
      },
    } as unknown as ToolDefinition;

    expect(() => registry.register(malformedTool)).toThrowError(McpPlatformError);
  });

  it("lists tools in deterministic name order", () => {
    const registry = new ToolRegistry();
    registry.register(createValidTool("get_zulu"));
    registry.register(createValidTool("get_alpha"));
    registry.register(createValidTool("list_bravo"));

    expect(registry.list().map((tool) => tool.name)).toEqual([
      "get_alpha",
      "get_zulu",
      "list_bravo",
    ]);
  });
});

describe("execution context and errors", () => {
  it("generates a secure request ID for every context", () => {
    const generated = generateRequestId();
    const context = createToolExecutionContext({
      productId: "platform-smoke",
      scopes: ["mcp:read"],
    });

    expect(generated).toMatch(/^[0-9a-f]{8}-/i);
    expect(context.requestId).toMatch(/^[0-9a-f]{8}-/i);
    expect(context.requestId).not.toBe(generated);
    expect(context.scopes).toEqual(["mcp:read"]);
  });

  it("normalizes errors without stack traces or secret values", () => {
    const normalized = normalizeError(
      new McpPlatformError({
        code: "UPSTREAM_FAILURE",
        message:
          "Authorization: Bearer super-secret api_key=abc123 password=hunter2 refresh_token=secret",
        retryable: true,
      }),
      "request-123",
    );
    const serialized = JSON.stringify(normalized);

    expect(normalized).toEqual({
      error: {
        code: "UPSTREAM_FAILURE",
        message:
          "Authorization: Bearer [REDACTED] api_key=[REDACTED] password=[REDACTED] refresh_token=[REDACTED]",
        request_id: "request-123",
        retryable: true,
      },
    });
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain("refresh_token=secret");
  });

  it("does not expose absolute paths from known platform errors", () => {
    const normalized = normalizeError(
      new McpPlatformError({
        code: "INTERNAL_FAILURE",
        message: "Failed at C:\\Users\\Bobi\\secret.txt and /mnt/c/private.env",
      }),
      "request-456",
    );
    const serialized = JSON.stringify(normalized);

    expect(serialized).not.toContain("C:\\Users\\Bobi\\secret.txt");
    expect(serialized).not.toContain("/mnt/c/private.env");
    expect(serialized).toContain("[REDACTED_PATH]");
  });
});

describe("redaction", () => {
  it("redacts sensitive keys and inline values", () => {
    const redacted = redactSecrets({
      authorization: "Bearer super-secret",
      api_key: "abc123",
      password: "hunter2",
      nested: { refresh_token: "secret" },
    });
    const serialized = JSON.stringify(redacted);

    expect(redacted).toEqual({
      authorization: "[REDACTED]",
      api_key: "[REDACTED]",
      password: "[REDACTED]",
      nested: { refresh_token: "[REDACTED]" },
    });
    expect(serialized).not.toContain("super-secret");
    expect(serialized).not.toContain("abc123");
    expect(serialized).not.toContain("hunter2");
    expect(serialized).not.toContain('"secret"');
  });

  it("redacts explicit security-test string formats", () => {
    const value = redactString(
      "Authorization: Bearer super-secret api_key=abc123 password=hunter2 refresh_token=secret",
    );

    expect(value).toBe(
      "Authorization: Bearer [REDACTED] api_key=[REDACTED] password=[REDACTED] refresh_token=[REDACTED]",
    );
  });

  it("does not write raw secrets through the structured logger", () => {
    const lines: string[] = [];
    const logger = new ConsoleLogger("debug", (line) => lines.push(line));

    logger.info(
      "Authorization: Bearer super-secret api_key=abc123 password=hunter2 refresh_token=secret",
    );

    const output = lines.join("");
    expect(output).toContain("[REDACTED]");
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("abc123");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("refresh_token=secret");
  });
});

describe("configuration and platform tool", () => {
  it("fails fast when required configuration is absent", () => {
    expect(() => loadConfig({ MCP_PRODUCT_ID: "platform-smoke" })).toThrowError(
      McpPlatformError,
    );
  });

  it("defaults the log level to info", () => {
    expect(createConfig().logLevel).toBe("info");
  });

  it("returns safe get_platform_info output", async () => {
    const config = createConfig();
    const tool = createPlatformInfoTool(config);
    const output = await tool.execute(
      createToolExecutionContext({ productId: config.productId }),
      {},
    );

    expect(output).toEqual({
      platform: "MCP Platform",
      version: "0.1.0-test",
      product_id: "platform-smoke",
      product_name: "MCP Platform Smoke",
      transport: "stdio",
      read_only: true,
    });
  });

  it("does not expose sensitive runtime information in platform info", async () => {
    const config = createConfig();
    const output = await createPlatformInfoTool(config).execute(
      createToolExecutionContext({ productId: config.productId }),
      {},
    );
    const serialized = JSON.stringify(output).toLowerCase();

    for (const forbidden of [
      "hostname",
      "username",
      "cwd",
      "environment",
      "filesystem",
      "api_key",
      "token",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

describe("audited tool execution", () => {
  it("records a successful tool execution", async () => {
    const config = createConfig();
    const registry = new ToolRegistry();
    const auditSink = new RecordingAuditSink();
    registry.register(createPlatformInfoTool(config));

    const result = await executeToolCall({
      config,
      registry,
      logger: noopLogger,
      auditSink,
      toolName: "get_platform_info",
      rawInput: {},
    });

    expect(result.isError).toBe(false);
    expect(auditSink.events).toHaveLength(1);
    expect(auditSink.events[0]).toMatchObject({
      productId: "platform-smoke",
      toolName: "get_platform_info",
      success: true,
    });
  });

  it("records a failed tool execution without leaking its error", async () => {
    const config = createConfig();
    const registry = new ToolRegistry();
    const auditSink = new RecordingAuditSink();
    const failingTool: ToolDefinition<typeof emptyObjectSchema> = {
      ...createValidTool("get_failure"),
      execute() {
        throw new McpPlatformError({
          code: "SAFE_FAILURE",
          message: "password=hunter2",
        });
      },
    };
    registry.register(failingTool);

    const result = await executeToolCall({
      config,
      registry,
      logger: noopLogger,
      auditSink,
      toolName: "get_failure",
      rawInput: {},
    });

    expect(result.isError).toBe(true);
    expect(result.text).not.toContain("hunter2");
    expect(auditSink.events).toHaveLength(1);
    expect(auditSink.events[0]).toMatchObject({
      toolName: "get_failure",
      success: false,
      errorCode: "SAFE_FAILURE",
    });
  });
});
