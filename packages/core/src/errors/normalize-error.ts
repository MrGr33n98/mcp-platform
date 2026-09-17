import { redactString } from "../logging/redaction.js";
import { McpPlatformError } from "./mcp-platform-error.js";

export interface NormalizedMcpPlatformError {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly request_id: string;
    readonly retryable: boolean;
  };
}

export function normalizeError(
  error: unknown,
  requestId: string,
): NormalizedMcpPlatformError {
  if (error instanceof McpPlatformError) {
    return {
      error: {
        code: error.code,
        message: redactString(error.message),
        request_id: requestId,
        retryable: error.retryable,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected platform error occurred.",
      request_id: requestId,
      retryable: false,
    },
  };
}
