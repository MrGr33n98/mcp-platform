import { McpPlatformError } from "@mcp-platform/core";
import { isRetryableStatus } from "./retry.js";

export function createRailsApiHttpError(status: number): McpPlatformError {
  const mapped = httpErrorMap[status];
  if (mapped !== undefined) {
    return new McpPlatformError({
      code: mapped.code,
      message: mapped.message,
      retryable: mapped.retryable,
    });
  }

  return new McpPlatformError({
    code: "RAILS_API_UPSTREAM_ERROR",
    message: "Rails API returned an unexpected upstream error.",
    retryable: isRetryableStatus(status),
  });
}

export function createRailsApiTimeoutError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_TIMEOUT",
    message: "Rails API request timed out.",
    retryable: true,
  });
}

export function createRailsApiNetworkError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_NETWORK_ERROR",
    message: "Rails API request could not reach the configured API.",
    retryable: true,
  });
}

const httpErrorMap: Readonly<
  Record<number, { readonly code: string; readonly message: string; readonly retryable: boolean }>
> = {
  400: {
    code: "RAILS_API_BAD_REQUEST",
    message: "Rails API rejected the request.",
    retryable: false,
  },
  401: {
    code: "RAILS_API_UNAUTHORIZED",
    message: "Rails API authentication was rejected.",
    retryable: false,
  },
  403: {
    code: "RAILS_API_FORBIDDEN",
    message: "Rails API denied access to this resource.",
    retryable: false,
  },
  404: {
    code: "RAILS_API_NOT_FOUND",
    message: "Rails API resource was not found.",
    retryable: false,
  },
  409: {
    code: "RAILS_API_CONFLICT",
    message: "Rails API reported a state conflict.",
    retryable: false,
  },
  422: {
    code: "RAILS_API_UNPROCESSABLE",
    message: "Rails API could not process the request.",
    retryable: false,
  },
  429: {
    code: "RAILS_API_RATE_LIMITED",
    message: "Rails API rate limit was reached.",
    retryable: true,
  },
};

