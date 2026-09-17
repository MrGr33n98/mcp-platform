import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import {
  createToolExecutionContext,
  McpPlatformError,
  normalizeError,
  ToolRegistry,
  type ToolDefinition,
} from "@mcp-platform/core";
import { RailsApiClient } from "@mcp-platform/rails-api-client";
import {
  createApiKeyUsageTool,
  createFailedWebhooksTool,
  createIntegrationHealthTool,
  createSharedCapabilities,
  createSubscriptionSummaryTool,
  createSystemHealthTool,
  createUsageSummaryTool,
  type SharedEndpointMap,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

const endpointMap = {
  systemHealth: "/api/test/system-health",
  integrationHealth: "/api/test/integration-health",
  subscriptionSummary: "/api/test/subscription-summary",
  usageSummary: "/api/test/usage-summary",
  failedWebhooks: "/api/test/failed-webhooks",
  apiKeyUsage: "/api/test/api-key-usage",
} satisfies SharedEndpointMap;

describe("shared read-only tools", () => {
  it("creates only read-only tools", () => {
    const tools = createSharedTools("http://127.0.0.1:65530");

    expect(tools).toHaveLength(6);
    expect(tools.every((tool) => tool.readOnly)).toBe(true);
  });

  it("exposes only endpoint-backed shared capabilities", () => {
    const capabilities = createSharedCapabilities({
      systemHealth: "/health",
    });

    expect(capabilities.hasCapability("system_health")).toBe(true);
    expect(capabilities.hasCapability("usage_summary")).toBe(false);
    expect(capabilities.requireCapability("system_health")).toBe(
      "/health",
    );
  });

  it("returns a healthy system health response", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        status: "healthy",
        checks: [{ name: "rails", status: "healthy" }],
        timestamp: "2026-09-17T12:00:00Z",
      });
    }, async (server) => {
      const [tool] = createSharedTools(server.baseUrl);
      if (tool === undefined) throw new Error("System health tool was not created.");

      await expect(tool.execute(createContext(), {})).resolves.toEqual({
        status: "healthy",
        checks: [{ name: "rails", status: "healthy" }],
        timestamp: "2026-09-17T12:00:00Z",
      });
      expect(server.requests).toEqual(["/api/test/system-health"]);
    });
  });

  it("returns a degraded system health response", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        status: "degraded",
        checks: [
          {
            name: "background-processing",
            status: "degraded",
            message: "Delayed work is being monitored.",
          },
        ],
      });
    }, async (server) => {
      const [tool] = createSharedTools(server.baseUrl);
      if (tool === undefined) throw new Error("System health tool was not created.");

      await expect(tool.execute(createContext(), {})).resolves.toMatchObject({
        status: "degraded",
      });
    });
  });

  it("blocks an invalid upstream health response", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        status: "unknown",
        checks: [],
        database_url: "postgres://not-safe",
      });
    }, async (server) => {
      const [tool] = createSharedTools(server.baseUrl);
      if (tool === undefined) throw new Error("System health tool was not created.");

      await expectMcpError(
        tool.execute(createContext(), {}),
        "RAILS_API_INVALID_RESPONSE",
      );
    });
  });

  it("blocks health diagnostics containing internal URLs or secrets", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        status: "unhealthy",
        checks: [
          {
            name: "database",
            status: "unhealthy",
            message: "postgres://db.internal.example:5432 is unavailable",
          },
        ],
      });
    }, async (server) => {
      const [tool] = createSharedTools(server.baseUrl);
      if (tool === undefined) throw new Error("System health tool was not created.");
      const error = await expectMcpError(
        tool.execute(createContext(), {}),
        "RAILS_API_INVALID_RESPONSE",
      );

      expect(JSON.stringify(normalizeError(error, "request-shared-test"))).not.toContain(
        "db.internal.example",
      );
    });
  });

  it("returns integration health for a logical integration name", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        integrations: [{ name: "crm", status: "healthy" }],
      });
    }, async (server) => {
      const tools = createSharedTools(server.baseUrl);
      const tool = tools.find((candidate) => candidate.name === "get_integration_health");
      if (tool === undefined) throw new Error("Integration health tool was not created.");

      await expect(tool.execute(createContext(), { integration: "crm" })).resolves.toEqual({
        integrations: [{ name: "crm", status: "healthy" }],
      });
      expect(server.requests).toEqual(["/api/test/integration-health?integration=crm"]);
    });
  });

  it("returns a safe subscription summary", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        plan: "growth",
        status: "active",
        billing_interval: "monthly",
        current_period_start: "2026-09-01T00:00:00Z",
        current_period_end: "2026-10-01T00:00:00Z",
        usage_limits: [{ name: "projects", limit: 25, unit: "projects" }],
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_subscription_summary");

      await expect(tool.execute(createContext(), {})).resolves.toMatchObject({
        plan: "growth",
        status: "active",
      });
    });
  });

  it("returns usage summary for a controlled period", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        metrics: [{ name: "requests", value: 42, unit: "requests", limit: 100 }],
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_usage_summary");

      await expect(
        tool.execute(createContext(), { period: "last_7_days" }),
      ).resolves.toEqual({
        metrics: [{ name: "requests", value: 42, unit: "requests", limit: 100 }],
      });
      expect(server.requests).toEqual(["/api/test/usage-summary?period=last_7_days"]);
    });
  });

  it("rejects an invalid usage period before calling Rails", async () => {
    const registry = new ToolRegistry();
    const tool = findTool(createSharedTools("http://127.0.0.1:65530"), "get_usage_summary");
    registry.register(tool);

    await expectMcpError(
      registry.execute(
        "get_usage_summary",
        { period: "2026-01-01; DROP TABLE usage" },
        createContext(),
      ),
      "INVALID_TOOL_INPUT",
    );
  });

  it("uses validated pagination for failed webhooks", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        items: [
          {
            id: "delivery-1",
            event_type: "invoice.failed",
            status: "failed",
            attempts: 3,
            last_attempt_at: "2026-09-17T12:00:00Z",
            created_at: "2026-09-17T10:00:00Z",
          },
        ],
        pagination: { page: 2, per_page: 100, total: 101 },
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_failed_webhooks");

      await expect(tool.execute(createContext(), { page: 2, per_page: 100 })).resolves.toMatchObject({
        pagination: { page: 2, per_page: 100, total: 101 },
      });
      expect(server.requests).toEqual(["/api/test/failed-webhooks?page=2&per_page=100"]);
    });
  });

  it("rejects invalid webhook page values", async () => {
    const registry = new ToolRegistry();
    registry.register(
      findTool(createSharedTools("http://127.0.0.1:65530"), "get_failed_webhooks"),
    );

    await expectMcpError(
      registry.execute("get_failed_webhooks", { page: 0 }, createContext()),
      "INVALID_TOOL_INPUT",
    );
  });

  it("rejects webhook per_page values greater than 100", async () => {
    const registry = new ToolRegistry();
    registry.register(
      findTool(createSharedTools("http://127.0.0.1:65530"), "get_failed_webhooks"),
    );

    await expectMcpError(
      registry.execute("get_failed_webhooks", { per_page: 101 }, createContext()),
      "INVALID_TOOL_INPUT",
    );
  });

  it("returns safe API key usage metadata", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        items: [
          {
            id: "key-1",
            name: "analytics integration",
            prefix: "mcp_live",
            scopes: ["mcp:read"],
            last_used_at: "2026-09-17T12:00:00Z",
            request_count: 12,
          },
        ],
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_api_key_usage");

      await expect(tool.execute(createContext(), {})).resolves.toEqual({
        items: [
          {
            id: "key-1",
            name: "analytics integration",
            prefix: "mcp_live",
            scopes: ["mcp:read"],
            last_used_at: "2026-09-17T12:00:00Z",
            request_count: 12,
          },
        ],
      });
    });
  });

  it("never returns raw API key material", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        items: [{ id: "key-1", api_key: "raw-api-key-should-not-leak" }],
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_api_key_usage");
      const error = await expectMcpError(
        tool.execute(createContext(), {}),
        "RAILS_API_INVALID_RESPONSE",
      );

      expect(JSON.stringify(normalizeError(error, "request-shared-test"))).not.toContain(
        "raw-api-key-should-not-leak",
      );
    });
  });

  it("never returns webhook secrets", async () => {
    await withServer((_request, response) => {
      sendJson(response, 200, {
        items: [
          {
            id: "delivery-1",
            event_type: "invoice.failed",
            status: "failed",
            attempts: 1,
            signature_secret: "webhook-secret-should-not-leak",
          },
        ],
        pagination: { page: 1, per_page: 25 },
      });
    }, async (server) => {
      const tool = findTool(createSharedTools(server.baseUrl), "get_failed_webhooks");
      const error = await expectMcpError(
        tool.execute(createContext(), { page: 1, per_page: 25 }),
        "RAILS_API_INVALID_RESPONSE",
      );

      expect(JSON.stringify(normalizeError(error, "request-shared-test"))).not.toContain(
        "webhook-secret-should-not-leak",
      );
    });
  });

  it("fails safely when a configured capability is absent", async () => {
    const client = createClient("http://127.0.0.1:65530");
    const tool = createSystemHealthTool({
      client,
      capabilities: createSharedCapabilities({}),
    });

    await expectMcpError(
      Promise.resolve().then(() => tool.execute(createContext(), {})),
      "CAPABILITY_NOT_AVAILABLE",
    );
  });

  it("does not accept endpoint mapping from model input", async () => {
    const registry = new ToolRegistry();
    const tool = createSystemHealthTool({
      client: createClient("http://127.0.0.1:65530"),
      capabilities: createSharedCapabilities(endpointMap),
    });
    registry.register(tool);

    await expectMcpError(
      registry.execute(
        "get_system_health",
        { endpoint: "/api/test/model-controlled-endpoint" },
        createContext(),
      ),
      "INVALID_TOOL_INPUT",
    );
  });

  it("rejects unsafe endpoint mapping configuration", () => {
    expect(() =>
      createSharedCapabilities({
        systemHealth: "https://untrusted.example/api/test/health",
      }),
    ).toThrow(/Shared tool endpoint configuration is invalid/);

    expect(() =>
      createSharedCapabilities({ systemHealth: "/not-health" }),
    ).toThrow(/Shared tool endpoint configuration is invalid/);
  });

  it.each([
    [401, "RAILS_API_UNAUTHORIZED"],
    [403, "RAILS_API_FORBIDDEN"],
    [429, "RAILS_API_RATE_LIMITED"],
    [503, "RAILS_API_UPSTREAM_ERROR"],
  ] as const)("normalizes upstream status %i", async (status, expectedCode) => {
    await withServer((_request, response) => {
      response.writeHead(status);
      response.end();
    }, async (server) => {
      const tool = createSystemHealthTool({
        client: createClient(server.baseUrl),
        capabilities: createSharedCapabilities(endpointMap),
      });
      const error = await expectMcpError(
        tool.execute(createContext(), {}),
        expectedCode,
      );

      expect(normalizeError(error, "request-upstream").error).toMatchObject({
        code: expectedCode,
        request_id: "request-upstream",
      });
    });
  });

  it("registers all shared tools with deterministic names and valid schemas", () => {
    const registry = new ToolRegistry();
    const tools = createSharedTools("http://127.0.0.1:65530");

    for (const tool of tools) {
      registry.register(tool);
    }

    expect(registry.list().map((tool) => tool.name)).toEqual([
      "get_api_key_usage",
      "get_failed_webhooks",
      "get_integration_health",
      "get_subscription_summary",
      "get_system_health",
      "get_usage_summary",
    ]);
    expect(registry.list().every((tool) => tool.readOnly)).toBe(true);
  });
});

function createSharedTools(baseUrl: string): ToolDefinition[] {
  const client = createClient(baseUrl);
  const capabilities = createSharedCapabilities(endpointMap);
  const options = { client, capabilities };

  return [
    createSystemHealthTool(options),
    createIntegrationHealthTool(options),
    createSubscriptionSummaryTool(options),
    createUsageSummaryTool(options),
    createFailedWebhooksTool(options),
    createApiKeyUsageTool(options),
  ];
}

function createClient(baseUrl: string): RailsApiClient {
  return new RailsApiClient(
    {
      baseUrl,
      apiKey: "shared-test-api-key",
      productId: "shared-test",
      clientName: "shared-tools-test",
      maxRetries: 0,
    },
    { wait: async () => undefined },
  );
}

function createContext() {
  return createToolExecutionContext({
    productId: "shared-test",
    requestId: "request-shared-test",
  });
}

function findTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (tool === undefined) {
    throw new Error(`Tool ${name} was not created.`);
  }

  return tool;
}

async function withServer<T>(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (server: { readonly baseUrl: string; readonly requests: string[] }) => Promise<T>,
): Promise<T> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
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
