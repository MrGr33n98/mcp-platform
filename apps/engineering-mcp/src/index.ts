import {
  ConsoleLogger,
  startStdioServer,
} from "@mcp-platform/core";
import { createEngineeringServer } from "./server.js";

function handleCliFlags(): boolean {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    // Note: CLI flags print to stdout only when invoked directly as a CLI tool before STDIO JSON-RPC starts
    process.stderr.write(`
MCP Platform V5 Engineering MCP Server

Usage:
  npx @mcp-platform/engineering-mcp [options]

Environment Variables:
  MCP_PRODUCT_ID            Product ID (default: engineering)
  MCP_PRODUCT_NAME          Product Name (default: Engineering Platform)
  MCP_LOG_LEVEL             Log level (debug, info, warn, error)
  MCP_VERSION               Server version (default: 0.1.0)

Options:
  --help, -h                Show this help message
  --version, -v             Show version information
\n`);
    return true;
  }

  if (args.includes("--version") || args.includes("-v")) {
    process.stderr.write("0.1.0\n");
    return true;
  }

  return false;
}

async function main(): Promise<void> {
  if (handleCliFlags()) {
    process.exit(0);
  }

  const { server, registry, logger, config } = createEngineeringServer();

  logger.info("Engineering MCP server started.", {
    product: config.productId,
    toolsCount: registry.list().length,
    status: "started",
  });

  await startStdioServer(server);
}

const bootstrapLogger = new ConsoleLogger("error");
void main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  bootstrapLogger.error(`Engineering MCP server failed to start: ${message}`, {
    status: "startup_error",
  });
  process.exitCode = 1;
});
