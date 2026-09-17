import { McpPlatformError } from "@mcp-platform/core";
import type { RailsApiResponseSchema } from "./schemas.js";

export async function readJsonResponse(
  response: Response,
  maxResponseBytes: number,
): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    const declaredLength = Number(contentLength);
    if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
      throw responseTooLargeError();
    }
  }

  const contentType = response.headers.get("content-type");
  if (!isJsonContentType(contentType)) {
    throw new McpPlatformError({
      code: "RAILS_API_UNEXPECTED_CONTENT_TYPE",
      message: "Rails API returned an unexpected response content type.",
      retryable: false,
    });
  }

  const body = await readBodyWithinLimit(response, maxResponseBytes);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new McpPlatformError({
      code: "RAILS_API_MALFORMED_JSON",
      message: "Rails API returned malformed JSON.",
      retryable: false,
    });
  }
}

export function validateResponse<TResponse>(
  response: unknown,
  responseSchema: RailsApiResponseSchema<TResponse> | undefined,
): TResponse {
  if (responseSchema === undefined) {
    return response as TResponse;
  }

  const parsed = responseSchema.safeParse(response);
  if (!parsed.success) {
    throw new McpPlatformError({
      code: "RAILS_API_INVALID_RESPONSE",
      message: "Rails API response did not match the expected schema.",
      retryable: false,
    });
  }

  return parsed.data;
}

function isJsonContentType(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType?.endsWith("+json") === true;
}

async function readBodyWithinLimit(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  if (response.body === null) {
    throw new McpPlatformError({
      code: "RAILS_API_MALFORMED_JSON",
      message: "Rails API returned malformed JSON.",
      retryable: false,
    });
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      const chunk = result.value;
      if (chunk === undefined) {
        throw new McpPlatformError({
          code: "RAILS_API_MALFORMED_JSON",
          message: "Rails API returned malformed JSON.",
          retryable: false,
        });
      }

      totalBytes += chunk.byteLength;
      if (totalBytes > maxResponseBytes) {
        await reader.cancel();
        throw responseTooLargeError();
      }

      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

function responseTooLargeError(): McpPlatformError {
  return new McpPlatformError({
    code: "RAILS_API_RESPONSE_TOO_LARGE",
    message: "Rails API response exceeded the configured size limit.",
    retryable: false,
  });
}
