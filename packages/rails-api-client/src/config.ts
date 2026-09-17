import { McpPlatformError } from "@mcp-platform/core";
import { z } from "zod";

export const DEFAULT_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface RailsApiClientConfig {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly productId: string;
  readonly clientName: string;
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly maxResponseBytes?: number;
}

export interface ValidatedRailsApiClientConfig {
  readonly baseUrl: URL;
  readonly apiKey: string;
  readonly productId: string;
  readonly clientName: string;
  readonly timeoutMs: number;
  readonly maxRetries: number;
  readonly maxResponseBytes: number;
}

export const railsApiClientConfigSchema = z
  .object({
    baseUrl: z.string().trim().min(1).max(2_048),
    apiKey: z.string().trim().min(1),
    productId: z.string().trim().regex(/^[a-z][a-z0-9-]*$/),
    clientName: z.string().trim().min(1).max(128),
    timeoutMs: z.number().int().min(1).max(60_000).default(DEFAULT_TIMEOUT_MS),
    maxRetries: z.number().int().min(0).max(DEFAULT_MAX_RETRIES).default(DEFAULT_MAX_RETRIES),
    maxResponseBytes: z
      .number()
      .int()
      .min(1_024)
      .max(20 * 1024 * 1024)
      .default(DEFAULT_MAX_RESPONSE_BYTES),
  })
  .strict();

export function parseRailsApiClientConfig(
  input: unknown,
): ValidatedRailsApiClientConfig {
  const parsed = railsApiClientConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw invalidConfigError();
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(parsed.data.baseUrl);
  } catch {
    throw invalidConfigError();
  }

  if (
    (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") ||
    baseUrl.username !== "" ||
    baseUrl.password !== "" ||
    baseUrl.search !== "" ||
    baseUrl.hash !== ""
  ) {
    throw invalidConfigError();
  }

  return {
    baseUrl,
    apiKey: parsed.data.apiKey,
    productId: parsed.data.productId,
    clientName: parsed.data.clientName,
    timeoutMs: parsed.data.timeoutMs,
    maxRetries: parsed.data.maxRetries,
    maxResponseBytes: parsed.data.maxResponseBytes,
  };
}

function invalidConfigError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_INVALID_CONFIG",
    message: "Rails API client configuration is invalid.",
    retryable: false,
  });
}
