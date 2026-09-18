import {
  ConsoleAuditSink,
  ConsoleLogger,
  MetricsCollector,
  TokenBucketRateLimiter,
  ToolRegistry,
  createMcpServer,
  createPlatformInfoTool,
  loadConfig,
  startStdioServer,
} from "@mcp-platform/core";
import { createOestAdapter, parseOestAdapterConfig } from "@mcp-platform/oest-adapter";
import { RailsApiClient } from "@mcp-platform/rails-api-client";

function handleCliFlags(): boolean {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
OEST / DroneHub Operational MCP Server

Usage:
  npx @mcp-platform/oest-mcp [options]

Environment Variables:
  OEST_API_URL            Base URL of the Rails backend (e.g. http://localhost:3000)
  OEST_MCP_API_KEY        API key Bearer token (dh_live_...)
  OEST_MCP_PRODUCT_ID     Product ID (default: oest)
  OEST_MCP_PRODUCT_NAME   Product Name (default: OEST DroneHub)
  MCP_LOG_LEVEL           Log level (debug, info, warn, error)
  OEST_RATE_LIMIT_RPM     Max requests per minute (default: 120)
  OEST_DASHBOARD_KIND     Dashboard scope (enterprise, operator, admin)

Options:
  --help, -h              Show this help message
  --version, -v           Show version information
`);
    return true;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("0.1.0");
    return true;
  }

  return false;
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`Missing required OEST MCP configuration: ${name}.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (handleCliFlags()) {
    process.exit(0);
  }

  const config = loadConfig({
    MCP_PRODUCT_ID: process.env["OEST_MCP_PRODUCT_ID"] ?? "oest",
    MCP_PRODUCT_NAME: process.env["OEST_MCP_PRODUCT_NAME"] ?? "OEST DroneHub",
    MCP_LOG_LEVEL: process.env["MCP_LOG_LEVEL"] ?? "info",
    MCP_VERSION: process.env["MCP_VERSION"] ?? "0.1.0",
  });

  const logger = new ConsoleLogger(config.logLevel);
  const metrics = new MetricsCollector();

  const maxRequestsPerMin = parseInt(process.env["OEST_RATE_LIMIT_RPM"] ?? "120", 10);
  const rateLimiter = new TokenBucketRateLimiter({
    maxRequests: maxRequestsPerMin,
    windowMs: 60_000,
    burstCapacity: Math.min(maxRequestsPerMin, 20),
  });

  const client = new RailsApiClient(
    {
      baseUrl: requiredEnvironment("OEST_API_URL"),
      apiKey: requiredEnvironment("OEST_MCP_API_KEY"),
      productId: config.productId,
      clientName: "oest-mcp",
    },
    { logger, rateLimiter },
  );

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
    rateLimitRpm: maxRequestsPerMin,
    toolsCount: registry.list().length,
    status: "started",
  });

  await startStdioServer(server);
}

const bootstrapLogger = new ConsoleLogger("error");
void main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  bootstrapLogger.error(`OEST MCP server failed to start: ${message}`, {
    status: "startup_error",
  });
  process.exitCode = 1;
});
