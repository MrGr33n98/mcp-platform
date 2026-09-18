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
import { createAvaliaAdapter, parseAvaliaAdapterConfig } from "@mcp-platform/avalia-adapter";
import { RailsApiClient } from "@mcp-platform/rails-api-client";

function handleCliFlags(): boolean {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Avalia Solar MCP Server

Usage:
  npx @mcp-platform/avalia-mcp [options]

Environment Variables:
  AVALIA_API_URL            Base URL of the Avalia Rails backend (e.g. http://localhost:3000)
  AVALIA_MCP_API_KEY        API key Bearer token
  AVALIA_MCP_PRODUCT_ID     Product ID (default: avalia)
  AVALIA_MCP_PRODUCT_NAME   Product Name (default: Avalia Solar)
  MCP_LOG_LEVEL             Log level (debug, info, warn, error)
  AVALIA_RATE_LIMIT_RPM     Max requests per minute (default: 120)

Options:
  --help, -h                Show this help message
  --version, -v             Show version information
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
    throw new Error(`Missing required Avalia MCP configuration: ${name}.`);
  }
  return value;
}

async function main(): Promise<void> {
  if (handleCliFlags()) {
    process.exit(0);
  }

  const config = loadConfig({
    MCP_PRODUCT_ID: process.env["AVALIA_MCP_PRODUCT_ID"] ?? "avalia",
    MCP_PRODUCT_NAME: process.env["AVALIA_MCP_PRODUCT_NAME"] ?? "Avalia Solar",
    MCP_LOG_LEVEL: process.env["MCP_LOG_LEVEL"] ?? "info",
    MCP_VERSION: process.env["MCP_VERSION"] ?? "0.1.0",
  });

  const logger = new ConsoleLogger(config.logLevel);
  const metrics = new MetricsCollector();

  const maxRequestsPerMin = parseInt(process.env["AVALIA_RATE_LIMIT_RPM"] ?? "120", 10);
  const rateLimiter = new TokenBucketRateLimiter({
    maxRequests: maxRequestsPerMin,
    windowMs: 60_000,
    burstCapacity: Math.min(maxRequestsPerMin, 20),
  });

  const client = new RailsApiClient(
    {
      baseUrl: requiredEnvironment("AVALIA_API_URL"),
      apiKey: requiredEnvironment("AVALIA_MCP_API_KEY"),
      productId: config.productId,
      clientName: "avalia-mcp",
    },
    { logger, rateLimiter },
  );

  const adapter = createAvaliaAdapter({
    client,
    config: parseAvaliaAdapterConfig({}),
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

  logger.info("Avalia Solar MCP server started.", {
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
  bootstrapLogger.error(`Avalia MCP server failed to start: ${message}`, {
    status: "startup_error",
  });
  process.exitCode = 1;
});
