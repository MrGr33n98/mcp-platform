import { McpPlatformError } from "../errors/mcp-platform-error.js";
import { mcpConfigSchema, type McpConfig } from "./config-schema.js";

export function loadConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): McpConfig {
  const result = mcpConfigSchema.safeParse(environment);
  if (!result.success) {
    throw new McpPlatformError({
      code: "INVALID_CONFIG",
      message: "MCP configuration is invalid.",
      retryable: false,
    });
  }

  return result.data;
}
