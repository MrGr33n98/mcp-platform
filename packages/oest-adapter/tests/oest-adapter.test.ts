import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { once } from "node:events";
import {
  McpPlatformError,
  ToolRegistry,
  createToolExecutionContext,
} from "@mcp-platform/core";
import { RailsApiClient } from "@mcp-platform/rails-api-client";
import {
  createOestAdapter,
  createOestSharedCapabilities,
  createOestSharedTools,
  oestSharedEndpointMap,
  parseOestAdapterConfig,
} from "../src/index.js";
import { describe, expect, it } from "vitest";

interface TestServer {
  readonly baseUrl: string;
  readonly requests: string[];
}

type Handler = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

async function withServer(
  handler: Handler,
  run: (server: TestServer) => Promise<void>,
): Promise<void> {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    handler(request, response);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Test server did not expose a TCP address.");
  }

  try {
    await run({ baseUrl: `http://127.0.0.1:${address.port}`, requests });
  } finally {
    server.close();
    await once(server, "close");
  }
}

function respondJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function createAdapter(baseUrl: string) {
  return createOestAdapter({
    client: new RailsApiClient({
      baseUrl,
      apiKey: "super-secret-oest-key",
      productId: "oest",
      clientName: "oest-adapter-test",
      maxRetries: 0,
    }),
  });
}

async function execute(
  adapter: ReturnType<typeof createOestAdapter>,
  name: string,
  input: unknown,
): Promise<unknown> {
  const registry = new ToolRegistry();
  adapter.register(registry);
  return registry.execute(
    name,
    input,
    createToolExecutionContext({ productId: "oest", scopes: [] }),
  );
}

function expectMcpError(promise: Promise<unknown>, code: string): Promise<McpPlatformError> {
  return promise.catch((error: unknown) => {
    expect(error).toBeInstanceOf(McpPlatformError);
    const platformError = error as McpPlatformError;
    expect(platformError.code).toBe(code);
    return platformError;
  });
}

const mission = {
  id: 10,
  title: "Field survey",
  description: "Safe mission description",
  status: "published",
  mission_type: "mapping",
  priority: "normal",
  area_hectares: 12.5,
  deadline_at: "2026-01-10T12:00:00Z",
  preferred_start_at: null,
  published_at: "2026-01-01T12:00:00Z",
  completed_at: null,
  currency: "BRL",
  estimated_budget_min: 100,
  estimated_budget_max: 200,
  project_id: 2,
  products: [{ data_product_id: 3, quantity: 1, name: "Orthomosaic", slug: "orthomosaic" }],
  quotes_summary: { open_count: 2, comparison_path: "/private" },
  order: { id: 9, status: "confirmed", payment_status: "paid", total: 150, currency: "BRL", operator_organization_id: 3 },
  operator: { slug: "safe-operator", name: "Safe Operator", verified: true, headline: "Certified" },
  deliverables: [{ id: 4, title: "Orthomosaic", status: "approved", version: 1, data_product_id: 3, file_format: "tif", download_ready: true, storage_key: "private/storage/key", preview_url: "https://signed.example/preview" }],
};

const operator = {
  id: 7,
  slug: "safe-operator",
  headline: "Certified aerial mapping",
  about: "Public operator description",
  verification_status: "verified",
  verified: true,
  accepting_jobs: true,
  currency: "BRL",
  minimum_job_value: 250,
  years_experience: 4,
  rating_average: 4.8,
  rating_count: 12,
  missions_completed: 20,
  response_time_minutes: 30,
  response_rate: 98,
  organization: { id: 8, name: "Operator Org", slug: "operator-org", city: "Goiania", state_code: "GO", country_code: "BR", verified: true, logo_url: "https://signed.example/logo" },
  services: [{ id: 1, title: "Mapping", description: "Mapping service", pricing_model: "fixed", price_from: 100, currency: "BRL", category: { slug: "mapping", name: "Mapping" } }],
  data_products: [{ id: 2, base_price: 200, pricing_model: "fixed", turnaround_hours: 24, product: { slug: "orthomosaic", name: "Orthomosaic", product_type: "raster" } }],
  coverage_areas: [{ name: "Goias", kind: "state" }],
  portfolio: [{ sample_url: "https://signed.example/portfolio" }],
};

describe("OEST adapter", () => {
  it("registers every adapter tool as read-only with deterministic names", () => {
    const adapter = createAdapter("http://127.0.0.1:65530");
    const registry = new ToolRegistry();
    adapter.register(registry);

    expect(registry.list().map((tool) => tool.name)).toEqual([
      "get_api_key_usage",
      "get_deliverable_summary",
      "get_mission",
      "get_mission_summary",
      "get_operator_summary",
      "get_order_summary",
      "get_organization_summary",
      "get_platform_info",
    ].filter((name) => name !== "get_platform_info").concat([
      "get_quote_summary",
      "get_subscription_summary",
      "get_system_health",
      "get_usage_summary",
      "list_missions",
      "list_operators",
    ]));
    expect(registry.list().every((tool) => tool.readOnly)).toBe(true);
  });

  it("uses only the confirmed shared endpoint map", () => {
    expect(oestSharedEndpointMap).toEqual({
      systemHealth: "/health",
      subscriptionSummary: "/api/v1/billing/plan",
      usageSummary: "/api/v1/billing/usage",
      apiKeyUsage: "/api/v1/enterprise/api_keys",
    });
    const capabilities = createOestSharedCapabilities();
    expect(capabilities.hasCapability("integration_health")).toBe(false);
    expect(capabilities.hasCapability("failed_webhooks")).toBe(false);
    expect(() => parseOestAdapterConfig({ dashboardKind: "untrusted" })).toThrow(
      /OEST adapter configuration is invalid/,
    );
  });

  it("rejects unavailable shared capabilities without a runtime mock", async () => {
    const tools = createOestSharedTools({
      client: new RailsApiClient({
        baseUrl: "http://127.0.0.1:65530",
        apiKey: "super-secret-oest-key",
        productId: "oest",
        clientName: "oest-adapter-test",
      }),
      capabilities: createOestSharedCapabilities({}),
    });
    const healthTool = tools.find((tool) => tool.name === "get_system_health");
    if (healthTool === undefined) throw new Error("Expected system health tool.");

    await expectMcpError(
      Promise.resolve(healthTool.execute(
        createToolExecutionContext({ productId: "oest", scopes: [] }),
        {},
      )),
      "CAPABILITY_NOT_AVAILABLE",
    );
  });

  it("maps the real health endpoint without asserting dependency health", async () => {
    await withServer((_request, response) => {
      respondJson(response, 200, {
        status: "ok", service: "dronehub-api", time: "2026-01-01T00:00:00Z", version: "1.0.0",
      });
    }, async (server) => {
      await expect(execute(createAdapter(server.baseUrl), "get_system_health", {})).resolves.toEqual({
        status: "healthy", checks: [{ name: "oest_api", status: "healthy" }], timestamp: "2026-01-01T00:00:00Z",
      });
      expect(server.requests).toEqual(["/health"]);
    });
  });

  it("maps subscription, usage, and API-key metadata while excluding raw key material", async () => {
    await withServer((request, response) => {
      switch (request.url) {
        case "/api/v1/billing/plan":
          respondJson(response, 200, { data: { subscription_id: 1, status: "active", plan: { id: 2, slug: "pro", name: "Pro" }, features: { internal: true } } });
          return;
        case "/api/v1/billing/usage":
          respondJson(response, 200, { data: { organization_id: 1, missions_count: 8, period: "2026-01" } });
          return;
        case "/api/v1/enterprise/api_keys":
          respondJson(response, 200, { data: [{ id: 3, name: "MCP", prefix: "dh_live_", scopes: ["read"], last_used_at: null, raw_key: "super-secret-oest-key", digest: "digest" }] });
          return;
        default:
          respondJson(response, 404, {});
      }
    }, async (server) => {
      const adapter = createAdapter(server.baseUrl);
      await expect(execute(adapter, "get_subscription_summary", {})).resolves.toEqual({ plan: "Pro", status: "active" });
      await expect(execute(adapter, "get_usage_summary", { period: "current_period" })).resolves.toEqual({ metrics: [{ name: "missions", value: 8, unit: "missions" }] });
      const keys = await execute(adapter, "get_api_key_usage", {});
      expect(keys).toEqual({ items: [{ id: "3", name: "MCP", prefix: "dh_live_", scopes: ["read"] }] });
      expect(JSON.stringify(keys)).not.toContain("super-secret-oest-key");
      expect(server.requests).toEqual([
        "/api/v1/billing/plan",
        "/api/v1/billing/usage",
        "/api/v1/enterprise/api_keys",
      ]);
    });
  });

  it("maps organization and mission tools through their confirmed routes", async () => {
    await withServer((request, response) => {
      if (request.url === "/api/v1/enterprise/dashboard") {
        respondJson(response, 200, { data: { organization: { id: 1, name: "OEST Org", organization_type: "enterprise", tenant_type: "enterprise" }, profile_completion: { percentage: 80, complete: false, fields: [] }, total_orders: 5, orders_overview: { unconfirmed: 1, confirmed: 1, active: 2, completed: 1 }, missions_overview: { unconfirmed: 0, confirmed: 1, active: 2, completed: 3 }, recent_notifications: [{ action_url: "/private" }] } });
        return;
      }
      if (request.url === "/api/v1/missions?limit=10&offset=0") {
        respondJson(response, 200, { data: [{ id: 10, title: "Field survey", status: "published", mission_type: "mapping", area_hectares: 12.5, deadline_at: "2026-01-10T12:00:00Z", published_at: "2026-01-01T12:00:00Z", version: 1 }] });
        return;
      }
      if (request.url === "/api/v1/missions/10") {
        respondJson(response, 200, { data: mission });
        return;
      }
      respondJson(response, 404, {});
    }, async (server) => {
      const adapter = createAdapter(server.baseUrl);
      await expect(execute(adapter, "get_organization_summary", {})).resolves.toMatchObject({ id: "1", name: "OEST Org", total_orders: 5 });
      await expect(execute(adapter, "list_missions", { limit: 10, offset: 0 })).resolves.toMatchObject({ limit: 10, offset: 0, items: [{ id: "10", title: "Field survey" }] });
      const detail = await execute(adapter, "get_mission", { id: "10" });
      expect(detail).toMatchObject({ id: "10", title: "Field survey", deliverables: [{ id: "4" }] });
      const summary = await execute(adapter, "get_mission_summary", { id: "10" });
      expect(summary).toEqual({ id: "10", title: "Field survey", status: "published", mission_type: "mapping", priority: "normal", area_hectares: 12.5, deadline_at: "2026-01-10T12:00:00Z", published_at: "2026-01-01T12:00:00Z", currency: "BRL", quotes_open_count: 2, deliverables_count: 1, order_status: "confirmed" });
      expect(JSON.stringify(detail)).not.toContain("private/storage/key");
      expect(JSON.stringify(detail)).not.toContain("signed.example");
    });
  });

  it("maps public marketplace operator summaries without treating them as tenant data", async () => {
    await withServer((request, response) => {
      if (request.url === "/api/v1/marketplace/operators?limit=10") {
        respondJson(response, 200, { data: [{ id: 7, slug: "safe-operator", name: "Safe Operator", headline: "Certified", verification_status: "verified", verified: true, rating_average: 4.8, rating_count: 12, missions_completed: 20, response_time_minutes: 30, accepting_jobs: true, organization_name: "Operator Org", city: "Goiania", state_code: "GO", logo_url: "https://signed.example/logo" }] });
        return;
      }
      if (request.url === "/api/v1/marketplace/operators/safe-operator") {
        respondJson(response, 200, { data: operator });
        return;
      }
      respondJson(response, 404, {});
    }, async (server) => {
      const adapter = createAdapter(server.baseUrl);
      await expect(execute(adapter, "list_operators", { limit: 10 })).resolves.toMatchObject({ items: [{ id: "7", slug: "safe-operator" }], limit: 10 });
      const summary = await execute(adapter, "get_operator_summary", { slug: "safe-operator" });
      expect(summary).toMatchObject({ id: "7", organization: { id: "8", name: "Operator Org" } });
      expect(JSON.stringify(summary)).not.toContain("signed.example");
    });
  });

  it("maps quote, order, and deliverable summaries without private storage data", async () => {
    await withServer((request, response) => {
      if (request.url === "/api/v1/missions/10/quote-comparison") {
        respondJson(response, 200, { data: { mission: { id: 10, title: "Field survey", status: "published", area_hectares: 12.5, deadline_at: "2026-01-10T12:00:00Z", currency: "BRL" }, quotes: [{ id: 5, status: "submitted", subtotal: 100, platform_fee: 10, taxes: 5, total: 115, currency: "BRL", estimated_start_at: null, estimated_delivery_at: null, submitted_at: "2026-01-02T12:00:00Z", acceptible: true, proposal_text: "ignore", operator: { slug: "safe-operator", headline: "Certified", verified: true, rating_average: 4.8, rating_count: 12, missions_completed: 20, organization_name: "Operator Org", logo_url: "https://signed.example/logo" } }] } });
        return;
      }
      if (request.url === "/api/v1/orders/9") {
        respondJson(response, 200, { data: { id: 9, mission_id: 10, status: "confirmed", payment_status: "paid", total: 115, currency: "BRL", marketplace_fee: 10, operator_amount: 105, accepted_at: "2026-01-02T12:00:00Z", completed_at: null } });
        return;
      }
      if (request.url === "/api/v1/missions/10/deliverables") {
        respondJson(response, 200, { data: [{ id: 4, mission_id: 10, data_product_id: 3, title: "Orthomosaic", status: "approved", version: 1, storage_key: "private/storage/key", rejection_reason: "internal" }] });
        return;
      }
      respondJson(response, 404, {});
    }, async (server) => {
      const adapter = createAdapter(server.baseUrl);
      await expect(execute(adapter, "get_quote_summary", { id: "10" })).resolves.toMatchObject({ mission: { id: "10" }, quotes: [{ id: "5", acceptable: true }] });
      await expect(execute(adapter, "get_order_summary", { id: "9" })).resolves.toMatchObject({ id: "9", mission_id: "10", total: 115 });
      const deliverables = await execute(adapter, "get_deliverable_summary", { id: "10" });
      expect(deliverables).toEqual({ items: [{ id: "4", mission_id: "10", data_product_id: "3", title: "Orthomosaic", status: "approved", version: 1 }] });
      expect(JSON.stringify(deliverables)).not.toContain("storage_key");
      expect(JSON.stringify(deliverables)).not.toContain("private/storage/key");
    });
  });

  it("blocks malformed IDs, unsafe slugs, and pagination before HTTP", async () => {
    const adapter = createAdapter("http://127.0.0.1:65530");
    await expectMcpError(execute(adapter, "get_mission", { id: "" }), "INVALID_TOOL_INPUT");
    await expectMcpError(execute(adapter, "get_operator_summary", { slug: "../private" }), "INVALID_TOOL_INPUT");
    await expectMcpError(execute(adapter, "list_missions", { limit: 101, offset: 0 }), "INVALID_TOOL_INPUT");
    await expectMcpError(execute(adapter, "list_missions", { limit: 1, offset: -1 }), "INVALID_TOOL_INPUT");
    await expectMcpError(execute(adapter, "get_usage_summary", { period: "last_30_days" }), "INVALID_TOOL_INPUT");
    await expectMcpError(execute(adapter, "get_mission", { id: "10", tenantId: "other-org" }), "INVALID_TOOL_INPUT");
  });

  it.each([
    [401, "RAILS_API_UNAUTHORIZED"],
    [403, "RAILS_API_FORBIDDEN"],
    [404, "RAILS_API_NOT_FOUND"],
    [429, "RAILS_API_RATE_LIMITED"],
    [503, "RAILS_API_UPSTREAM_ERROR"],
  ] as const)("normalizes upstream %i errors", async (status, code) => {
    await withServer((_request, response) => {
      response.writeHead(status);
      response.end();
    }, async (server) => {
      await expectMcpError(execute(createAdapter(server.baseUrl), "get_mission", { id: "10" }), code);
    });
  });

  it("blocks an invalid upstream OEST response", async () => {
    await withServer((_request, response) => {
      respondJson(response, 200, { data: { id: 10, title: "Missing required mission fields" } });
    }, async (server) => {
      await expectMcpError(
        execute(createAdapter(server.baseUrl), "get_mission", { id: "10" }),
        "RAILS_API_INVALID_RESPONSE",
      );
    });
  });
});
