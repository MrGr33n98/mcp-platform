import {
  ConsoleAuditSink,
  ConsoleLogger,
  ToolRegistry,
  createMcpServer,
  createPlatformInfoTool,
  loadConfig,
  startStdioServer,
} from "@mcp-platform/core";
import { createOestAdapter, parseOestAdapterConfig } from "@mcp-platform/oest-adapter";
import { RailsApiClient } from "@mcp-platform/rails-api-client";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`Missing required OEST MCP configuration: ${name}.`);
  }
  return value;
}

async function main(): Promise<void> {
  const config = loadConfig({
    MCP_PRODUCT_ID: requiredEnvironment("OEST_MCP_PRODUCT_ID"),
    MCP_PRODUCT_NAME: requiredEnvironment("OEST_MCP_PRODUCT_NAME"),
    MCP_LOG_LEVEL: process.env["MCP_LOG_LEVEL"],
    MCP_VERSION: process.env["MCP_VERSION"] ?? "0.1.0",
  });
  const logger = new ConsoleLogger(config.logLevel);
  const client = new RailsApiClient({
    baseUrl: requiredEnvironment("OEST_API_URL"),
    apiKey: requiredEnvironment("OEST_MCP_API_KEY"),
    productId: config.productId,
    clientName: "oest-mcp",
  }, { logger });
  const dashboardKind = process.env["OEST_DASHBOARD_KIND"];
  const adapter = createOestAdapter({
    client,
    config: parseOestAdapterConfig(
      dashboardKind === undefined ? {} : { dashboardKind },
    ),
  });
  const registry = new ToolRegistry();
  registry.register(createPlatformInfoTool(config));
  adapter.register(registry);

  const server = createMcpServer({
    config,
    registry,
    logger,
    auditSink: new ConsoleAuditSink(),
  });

  logger.info("OEST MCP server started.", {
    product: config.productId,
    status: "started",
  });
  await startStdioServer(server);
}

const bootstrapLogger = new ConsoleLogger("error");
void main().catch(() => {
  bootstrapLogger.error("OEST MCP server failed to start.", {
    status: "startup_error",
  });
  process.exitCode = 1;
});
