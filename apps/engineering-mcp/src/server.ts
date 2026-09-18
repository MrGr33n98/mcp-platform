import {
  ConsoleAuditSink,
  ConsoleLogger,
  ToolRegistry,
  createMcpServer,
  loadConfig,
  type McpConfig,
  type Logger,
  type AuditSink,
} from "@mcp-platform/core";
import type { McpServer } from "@modelcontextprotocol/server";
import { registerEngineeringTools } from "./tools/register-all.js";

export interface EngineeringServerOptions {
  config?: McpConfig;
  logger?: Logger;
  auditSink?: AuditSink;
  registry?: ToolRegistry;
}

export function createEngineeringServer(options?: EngineeringServerOptions): {
  server: McpServer;
  registry: ToolRegistry;
  config: McpConfig;
  logger: Logger;
  auditSink: AuditSink;
} {
  const config =
    options?.config ??
    loadConfig({
      MCP_PRODUCT_ID: process.env["MCP_PRODUCT_ID"] ?? "engineering",
      MCP_PRODUCT_NAME: process.env["MCP_PRODUCT_NAME"] ?? "Engineering Platform",
      MCP_LOG_LEVEL: process.env["MCP_LOG_LEVEL"] ?? "info",
      MCP_VERSION: process.env["MCP_VERSION"] ?? "0.1.0",
    });

  const logger = options?.logger ?? new ConsoleLogger(config.logLevel);
  const auditSink = options?.auditSink ?? new ConsoleAuditSink();
  const registry = options?.registry ?? new ToolRegistry();

  registerEngineeringTools(registry);

  const server = createMcpServer({
    config,
    registry,
    logger,
    auditSink,
  });

  return {
    server,
    registry,
    config,
    logger,
    auditSink,
  };
}
