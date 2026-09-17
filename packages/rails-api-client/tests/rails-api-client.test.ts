import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { McpPlatformError, normalizeError, redactString, type Logger } from "@mcp-platform/core";
import { z } from "zod";
import {
  DEFAULT_MAX_RESPONSE_BYTES,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT_MS,
  parseRailsApiClientConfig,
  RailsApiClient,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

interface RecordedRequest {
  readonly method: string | undefined;
  readonly url: string | undefined;
  readonly headers: IncomingHttpHeaders;
}

interface MockServer {
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  close(): Promise<void>;
}

type MockHandler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void | Promise<void>;

interface TestClientOptions {
  readonly timeoutMs?: number;
  readonly maxRetries?: number;
  readonly maxResponseBytes?: number;
  readonly fetch?: typeof fetch;
  readonly logger?: Logger;
}

describe("RailsApiClient", () => {
  it("sends the Bearer authorization header", async () => {
    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl);

      await client.get({ path: "/api/v1/health", requestId: "request-header-auth" });

      expect(server.requests[0]?.headers.authorization).toBe(
        "Bearer super-secret-api-key",
      );
    });
  });

  it("sends X-Request-ID", async () => {
    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl);

      await client.get({ path: "/api/v1/health", requestId: "request-header-id" });

      expect(server.requests[0]?.headers["x-request-id"]).toBe("request-header-id");
    });
  });

  it("sends X-MCP-Client", async () => {
    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl);

      await client.get({ path: "/api/v1/health", requestId: "request-header-client" });

      expect(server.requests[0]?.headers["x-mcp-client"]).toBe("rails-api-client-test");
    });
  });

  it("sends X-Product-ID", async () => {
    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl);

      await client.get({ path: "/api/v1/health", requestId: "request-header-product" });

      expect(server.requests[0]?.headers["x-product-id"]).toBe("test-product");
    });
  });

  it("encodes supported query parameters", async () => {
    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl);

      await client.get({
        path: "/api/v1/search",
        query: { term: "solar panel", page: 2, active: true, unused: undefined },
        requestId: "request-query",
      });

      expect(server.requests[0]?.url).toBe(
        "/api/v1/search?term=solar+panel&page=2&active=true",
      );
    });
  });

  it("rejects arbitrary external URLs", async () => {
    const client = createClient("http://127.0.0.1:65530");

    await expectMcpError(
      client.get({
        path: "https://arbitrary-host.example/api/v1/tenants",
        requestId: "request-external-url",
      }),
      "RAILS_API_INVALID_PATH",
    );
  });

  it("rejects protocol-relative URLs", async () => {
    const client = createClient("http://127.0.0.1:65530");

    await expectMcpError(
      client.get({
        path: "//arbitrary-host.example/api/v1/tenants",
        requestId: "request-protocol-relative",
      }),
      "RAILS_API_INVALID_PATH",
    );
  });

  it("rejects non-GET mutation methods by exposing no mutation methods", () => {
    expect("post" in RailsApiClient.prototype).toBe(false);
    expect("put" in RailsApiClient.prototype).toBe(false);
    expect("patch" in RailsApiClient.prototype).toBe(false);
    expect("delete" in RailsApiClient.prototype).toBe(false);
  });

  it("maps an aborted request to RAILS_API_TIMEOUT", async () => {
    await withServer(() => undefined, async (server) => {
      const client = createClient(server.baseUrl, { timeoutMs: 25 });

      const error = await expectMcpError(
        client.get({ path: "/api/v1/slow", requestId: "request-timeout" }),
        "RAILS_API_TIMEOUT",
      );

      expect(error.retryable).toBe(true);
      expect(server.requests).toHaveLength(3);
    });
  });

  it.each([429, 502, 503, 504])("retries status %i", async (status) => {
    let attemptCount = 0;
    await withServer((_request, response) => {
      attemptCount += 1;
      if (attemptCount === 1) {
        response.writeHead(status);
        response.end();
        return;
      }

      sendJson(response, 200, { ok: true });
    }, async (server) => {
      const client = createClient(server.baseUrl, { maxRetries: 2 });

      await expect(
        client.get({ path: "/api/v1/retry", requestId: `request-retry-${status}` }),
      ).resolves.toEqual({ ok: true });
    });

    expect(attemptCount).toBe(2);
  });

  it("retries a transient network failure without exposing its raw message", async () => {
    let fetchCount = 0;
    const fetchWithOneTransientFailure: typeof fetch = async (input, init) => {
      fetchCount += 1;
      if (fetchCount === 1) {
        throw new TypeError("Authorization: Bearer transient-network-secret");
      }

      return globalThis.fetch(input, init);
    };

    await withServer(sendSuccessfulJson, async (server) => {
      const client = createClient(server.baseUrl, {
        maxRetries: 2,
        fetch: fetchWithOneTransientFailure,
      });

      await expect(
        client.get({ path: "/api/v1/network", requestId: "request-network-retry" }),
      ).resolves.toEqual({ ok: true });
    });

    expect(fetchCount).toBe(2);
  });

  it.each([
    [400, "RAILS_API_BAD_REQUEST"],
    [401, "RAILS_API_UNAUTHORIZED"],
    [403, "RAILS_API_FORBIDDEN"],
    [404, "RAILS_API_NOT_FOUND"],
    [422, "RAILS_API_UNPROCESSABLE"],
  ] as const)("does not retry status %i", async (status, expectedCode) => {
    let attemptCount = 0;
    await withServer((_request, response) => {
      attemptCount += 1;
      response.writeHead(status);
      response.end();
    }, async (server) => {
      const client = createClient(server.baseUrl, { maxRetries: 2 });

      await expectMcpError(
        client.get({ path: "/api/v1/no-retry", requestId: `request-no-retry-${status}` }),
        expectedCode,
      );
    });

    expect(attemptCount).toBe(1);
  });

  it("rejects malformed JSON", async () => {
    await withServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{");
    }, async (server) => {
      const client = createClient(server.baseUrl);

      await expectMcpError(
        client.get({ path: "/api/v1/malformed", requestId: "request-malformed" }),
        "RAILS_API_MALFORMED_JSON",
      );
    });
  });

  it("rejects a non-JSON content type", async () => {
    await withServer((_request, response) => {
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("not json");
    }, async (server) => {
      const client = createClient(server.baseUrl);

      await expectMcpError(
        client.get({ path: "/api/v1/plain", requestId: "request-content-type" }),
        "RAILS_API_UNEXPECTED_CONTENT_TYPE",
      );
    });
  });

  it("rejects an oversized response before parsing it", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, { payload: "x".repeat(2_048) });
    }, async (server) => {
      const client = createClient(server.baseUrl, { maxResponseBytes: 1_024 });

      await expectMcpError(
        client.get({ path: "/api/v1/large", requestId: "request-large" }),
        "RAILS_API_RESPONSE_TOO_LARGE",
      );
    });
  });

  it("validates a successful JSON response with Zod", async () => {
    const responseSchema = z.object({ id: z.string(), active: z.boolean() }).strict();
    await withServer((_request, response) => {
      sendJson(response, 200, { id: "company-1", active: true });
    }, async (server) => {
      const client = createClient(server.baseUrl);

      await expect(
        client.get({
          path: "/api/v1/company",
          requestId: "request-zod-success",
          responseSchema,
        }),
      ).resolves.toEqual({ id: "company-1", active: true });
    });
  });

  it("rejects a JSON response that fails Zod validation", async () => {
    const responseSchema = z.object({ id: z.string(), active: z.boolean() }).strict();
    await withServer((_request, response) => {
      sendJson(response, 200, { id: 42, active: "yes" });
    }, async (server) => {
      const client = createClient(server.baseUrl);

      await expectMcpError(
        client.get({
          path: "/api/v1/company",
          requestId: "request-zod-invalid",
          responseSchema,
        }),
        "RAILS_API_INVALID_RESPONSE",
      );
    });
  });

  it("accepts a 204 response without trying to parse JSON", async () => {
    await withServer((_request, response) => {
      response.writeHead(204);
      response.end();
    }, async (server) => {
      const client = createClient(server.baseUrl);

      await expect(
        client.get({ path: "/api/v1/empty", requestId: "request-empty" }),
      ).resolves.toBeUndefined();
    });
  });

  it("stops retrying after the configured maximum", async () => {
    let attemptCount = 0;
    await withServer((_request, response) => {
      attemptCount += 1;
      response.writeHead(503);
      response.end();
    }, async (server) => {
      const client = createClient(server.baseUrl, { maxRetries: 2 });

      await expectMcpError(
        client.get({ path: "/api/v1/exhausted", requestId: "request-max-retry" }),
        "RAILS_API_UPSTREAM_ERROR",
      );
    });

    expect(attemptCount).toBe(3);
  });

  it("keeps authorization and other secrets out of normalized errors and logs", async () => {
    const loggedRecords: unknown[] = [];
    const logger = createRecordingLogger(loggedRecords);
    await withServer((_request, response) => {
      response.writeHead(401, {
        authorization: "Bearer super-secret",
        "set-cookie": "session=secret-cookie",
      });
      response.end();
    }, async (server) => {
      const client = createClient(server.baseUrl, { logger });
      const error = await expectMcpError(
        client.get({ path: "/api/v1/private", requestId: "request-redaction" }),
        "RAILS_API_UNAUTHORIZED",
      );

      const normalized = normalizeError(error, "request-redaction");
      const output = JSON.stringify({ normalized, loggedRecords });
      for (const secret of [
        "super-secret",
        "super-secret-api-key",
        "secret-cookie",
      ]) {
        expect(output).not.toContain(secret);
      }
    });

    const redacted = redactString(
      "Authorization: Bearer super-secret api_key=abc123 password=hunter2 refresh_token=secret",
    );
    for (const secret of ["super-secret", "abc123", "hunter2", "refresh_token=secret"]) {
      expect(redacted).not.toContain(secret);
    }
  });

  it("normalizes Rails API errors through the core error contract", async () => {
    await withServer((_request, response) => {
      response.writeHead(403);
      response.end();
    }, async (server) => {
      const client = createClient(server.baseUrl);
      const error = await expectMcpError(
        client.get({ path: "/api/v1/forbidden", requestId: "request-normalized" }),
        "RAILS_API_FORBIDDEN",
      );

      expect(normalizeError(error, "request-normalized")).toEqual({
        error: {
          code: "RAILS_API_FORBIDDEN",
          message: "Rails API denied access to this resource.",
          request_id: "request-normalized",
          retryable: false,
        },
      });
    });
  });

  it("validates configuration defaults and rejects an unsafe base URL", () => {
    const config = parseRailsApiClientConfig({
      baseUrl: "https://rails.example.test",
      apiKey: "api-key",
      productId: "test-product",
      clientName: "test-client",
    });

    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(config.maxRetries).toBe(DEFAULT_MAX_RETRIES);
    expect(config.maxResponseBytes).toBe(DEFAULT_MAX_RESPONSE_BYTES);

    expect(() =>
      parseRailsApiClientConfig({
        baseUrl: "ftp://rails.example.test",
        apiKey: "api-key",
        productId: "test-product",
        clientName: "test-client",
      }),
    ).toThrow(/Rails API client configuration is invalid/);
  });
});

function createClient(baseUrl: string, options: TestClientOptions = {}): RailsApiClient {
  return new RailsApiClient(
    {
      baseUrl,
      apiKey: "super-secret-api-key",
      productId: "test-product",
      clientName: "rails-api-client-test",
      ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
      ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }),
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    },
    {
      wait: async () => undefined,
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
      ...(options.logger === undefined ? {} : { logger: options.logger }),
    },
  );
}

async function withServer<T>(
  handler: MockHandler,
  run: (server: MockServer) => Promise<T>,
): Promise<T> {
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    requests.push({
      method: request.method,
      url: request.url,
      headers: request.headers,
    });
    void Promise.resolve(handler(request, response));
  });

  await listen(server);
  const address = server.address();
  if (address === null || typeof address === "string") {
    await close(server);
    throw new Error("Mock server did not expose a TCP address.");
  }

  try {
    return await run({
      baseUrl: `http://127.0.0.1:${address.port}`,
      requests,
      close: () => close(server),
    });
  } finally {
    await close(server);
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

function sendSuccessfulJson(_request: IncomingMessage, response: ServerResponse): void {
  sendJson(response, 200, { ok: true });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const serialized = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(serialized),
  });
  response.end(serialized);
}

async function expectMcpError<T>(
  operation: Promise<T>,
  expectedCode: string,
): Promise<McpPlatformError> {
  try {
    await operation;
  } catch (error) {
    expect(error).toBeInstanceOf(McpPlatformError);
    const platformError = error as McpPlatformError;
    expect(platformError.code).toBe(expectedCode);
    return platformError;
  }

  throw new Error(`Expected ${expectedCode} to be thrown.`);
}

function createRecordingLogger(records: unknown[]): Logger {
  const record = (message: string, fields: unknown): void => {
    records.push({ message, fields });
  };

  return {
    debug: record,
    info: record,
    warn: record,
    error: record,
  };
}
