import { McpPlatformError } from "@mcp-platform/core";
import type { ValidatedRailsApiClientConfig } from "./config.js";

export function createDefaultHeaders(
  config: ValidatedRailsApiClientConfig,
  requestId: string,
): Headers {
  if (typeof requestId !== "string" || requestId.trim() === "") {
    throw new McpPlatformError({
      code: "RAILS_API_INVALID_REQUEST_ID",
      message: "Rails API request ID is invalid.",
      retryable: false,
    });
  }

  return new Headers({
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
    "X-Request-ID": requestId,
    "X-MCP-Client": config.clientName,
    "X-Product-ID": config.productId,
  });
}
