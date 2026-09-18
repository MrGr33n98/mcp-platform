import { McpPlatformError } from "@mcp-platform/core";
import type { ValidatedRailsApiClientConfig } from "./config.js";

export interface CreateHeadersOptions {
  readonly idempotencyKey?: string | undefined;
  readonly hasBody?: boolean | undefined;
}


export function createDefaultHeaders(
  config: ValidatedRailsApiClientConfig,
  requestId: string,
  options: CreateHeadersOptions = {},
): Headers {
  if (typeof requestId !== "string" || requestId.trim() === "") {
    throw new McpPlatformError({
      code: "RAILS_API_INVALID_REQUEST_ID",
      message: "Rails API request ID is invalid.",
      retryable: false,
    });
  }

  const headers = new Headers({
    Authorization: `Bearer ${config.apiKey}`,
    Accept: "application/json",
    "X-Request-ID": requestId,
    "X-MCP-Client": config.clientName,
    "X-Product-ID": config.productId,
  });

  if (options.hasBody) {
    headers.set("Content-Type", "application/json");
  }

  if (options.idempotencyKey !== undefined && options.idempotencyKey.trim() !== "") {
    headers.set("Idempotency-Key", options.idempotencyKey.trim());
  }

  return headers;
}

