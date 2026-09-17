import { McpServer } from "@modelcontextprotocol/server";
import type { AuditSink } from "../audit/audit-sink.js";
import type { McpConfig } from "../config/config-schema.js";
import { createToolExecutionContext } from "../context/tool-execution-context.js";
import { McpPlatformError } from "../errors/mcp-platform-error.js";
import { normalizeError } from "../errors/normalize-error.js";
import type { Logger } from "../logging/logger.js";
import { redactSecrets } from "../logging/redaction.js";
import type { ToolRegistry } from "../registry/tool-registry.js";

export interface CreateMcpServerOptions {
  readonly config: McpConfig;
  readonly registry: ToolRegistry;
  readonly logger: Logger;
  readonly auditSink: AuditSink;
}

export interface ExecuteToolCallOptions extends CreateMcpServerOptions {
  readonly toolName: string;
  readonly rawInput: unknown;
}

export interface ToolCallExecutionResult {
  readonly isError: boolean;
  readonly text: string;
}

export function createMcpServer(options: CreateMcpServerOptions): McpServer {
  const server = new McpServer({
    name: `mcp-platform-${options.config.productId}`,
    version: options.config.version,
  });

  for (const tool of options.registry.list()) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (input) => {
        const result = await executeToolCall({
          ...options,
          toolName: tool.name,
          rawInput: input,
        });
        return {
          ...(result.isError ? { isError: true } : {}),
          content: [{ type: "text" as const, text: result.text }],
        };
      },
    );
  }

  return server;
}

export async function executeToolCall(
  options: ExecuteToolCallOptions,
): Promise<ToolCallExecutionResult> {
  const context = createToolExecutionContext({
    productId: options.config.productId,
    scopes: [],
  });
  const startedAt = Date.now();

  options.logger.info("Tool execution started.", {
    product: context.productId,
    tool: options.toolName,
    requestId: context.requestId,
    status: "started",
  });

  try {
    const output = await options.registry.execute(
      options.toolName,
      options.rawInput,
      context,
    );
    const durationMs = Date.now() - startedAt;

    await recordAuditSafely(options, {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      productId: context.productId,
      toolName: options.toolName,
      durationMs,
      success: true,
    });

    options.logger.info("Tool execution completed.", {
      product: context.productId,
      tool: options.toolName,
      requestId: context.requestId,
      durationMs,
      status: "success",
    });

    return { isError: false, text: serializeToolOutput(output) };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const normalizedError = normalizeError(error, context.requestId);

    await recordAuditSafely(options, {
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
      productId: context.productId,
      toolName: options.toolName,
      durationMs,
      success: false,
      errorCode: normalizedError.error.code,
    });

    options.logger.warn("Tool execution failed.", {
      product: context.productId,
      tool: options.toolName,
      requestId: context.requestId,
      durationMs,
      status: "error",
    });

    return { isError: true, text: JSON.stringify(normalizedError) };
  }
}

async function recordAuditSafely(
  options: CreateMcpServerOptions,
  event: Parameters<AuditSink["record"]>[0],
): Promise<void> {
  try {
    await options.auditSink.record(event);
  } catch {
    options.logger.error("Audit sink failed to record a tool execution.", {
      product: event.productId,
      tool: event.toolName,
      requestId: event.requestId,
      durationMs: event.durationMs,
      status: "audit_error",
    });
  }
}

function serializeToolOutput(output: unknown): string {
  try {
    const serialized = JSON.stringify(redactSecrets(output));
    if (serialized === undefined) {
      throw new McpPlatformError({
        code: "INVALID_TOOL_OUTPUT",
        message: "Tool output could not be serialized.",
      });
    }
    return serialized;
  } catch (error) {
    if (error instanceof McpPlatformError) {
      throw error;
    }

    throw new McpPlatformError({
      code: "INVALID_TOOL_OUTPUT",
      message: "Tool output could not be serialized.",
    });
  }
}
