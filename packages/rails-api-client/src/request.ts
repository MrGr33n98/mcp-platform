import { McpPlatformError } from "@mcp-platform/core";
import type { RailsApiQuery, RailsApiQueryValue, RailsApiResponseSchema } from "./schemas.js";

export interface RailsApiGetRequest<TResponse = unknown> {
  readonly path: string;
  readonly query?: RailsApiQuery;
  readonly requestId: string;
  readonly responseSchema?: RailsApiResponseSchema<TResponse>;
}

export function buildRelativeApiUrl(
  baseUrl: URL,
  path: string,
  query: RailsApiQuery | undefined,
): URL {
  validatePath(path);

  const target = new URL(path, baseUrl);
  if (target.origin !== baseUrl.origin || !target.pathname.startsWith("/api/")) {
    throw invalidPathError();
  }

  const serializedQuery = serializeQuery(query);
  target.search = serializedQuery;
  return target;
}

export function serializeQuery(query: RailsApiQuery | undefined): string {
  if (query === undefined) {
    return "";
  }

  if (query === null || Array.isArray(query) || typeof query !== "object") {
    throw invalidQueryError();
  }

  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key.trim() === "" || !isQueryValue(value)) {
      throw invalidQueryError();
    }

    if (value !== undefined) {
      parameters.append(key, String(value));
    }
  }

  return parameters.toString();
}

function validatePath(path: string): void {
  if (
    typeof path !== "string" ||
    !path.startsWith("/api/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#")
  ) {
    throw invalidPathError();
  }
}

function isQueryValue(value: unknown): value is RailsApiQueryValue {
  return (
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function invalidPathError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_INVALID_PATH",
    message: "Rails API requests must use an approved relative API path.",
    retryable: false,
  });
}

function invalidQueryError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_INVALID_QUERY",
    message: "Rails API query parameters are invalid.",
    retryable: false,
  });
}
