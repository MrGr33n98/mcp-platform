import {
  ConsoleAuditSink,
  ConsoleLogger,
  ToolRegistry,
  createMcpServer,
  createPlatformInfoTool,
  loadConfig,
  startStdioServer,
} from "@mcp-platform/core";

async function main(): Promise<void> {
  const config = loadConfig({
    MCP_PRODUCT_ID: process.env["MCP_PRODUCT_ID"] ?? "platform-smoke",
    MCP_PRODUCT_NAME:
      process.env["MCP_PRODUCT_NAME"] ?? "MCP Platform Smoke",
    MCP_LOG_LEVEL: process.env["MCP_LOG_LEVEL"],
    MCP_VERSION: process.env["MCP_VERSION"] ?? "0.1.0",
  });
  const logger = new ConsoleLogger(config.logLevel);
  const registry = new ToolRegistry();
  registry.register(createPlatformInfoTool(config));

  const server = createMcpServer({
    config,
    registry,
    logger,
    auditSink: new ConsoleAuditSink(),
  });

  logger.info("MCP smoke server started.", {
    product: config.productId,
    status: "started",
  });
  await startStdioServer(server);
}

const bootstrapLogger = new ConsoleLogger("error");
void main().catch(() => {
  bootstrapLogger.error("MCP smoke server failed to start.", {
    status: "startup_error",
  });
  process.exitCode = 1;
});
