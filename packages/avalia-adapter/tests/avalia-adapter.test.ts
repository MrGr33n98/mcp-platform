import { createServer, type Server } from "node:http";
import { describe, expect, it } from "vitest";
import {
  ConsoleLogger,
  McpPlatformError,
  ToolRegistry,
  createToolExecutionContext,
  type Logger,
} from "@mcp-platform/core";
import { RailsApiClient } from "@mcp-platform/rails-api-client";
import { createAvaliaAdapter } from "../src/index.js";

const noopLogger: Logger = new ConsoleLogger("error");

interface MockServer {
  readonly baseUrl: string;
  readonly requests: Array<{ method?: string; url?: string; body?: string }>;
  close(): Promise<void>;
}

async function withServer<T>(
  handler: (req: any, res: any) => void,
  run: (server: MockServer) => Promise<T>,
): Promise<T> {
  const requests: Array<{ method?: string; url?: string; body?: string }> = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body });
      handler(req, res);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("No TCP address");

  const mock: MockServer = {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    requests,
    close: () => new Promise<void>((res) => server.close(() => res())),
  };

  try {
    return await run(mock);
  } finally {
    await mock.close();
  }
}

function respondJson(res: any, status: number, data: any) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function createClient(baseUrl: string) {
  return new RailsApiClient({
    baseUrl,
    apiKey: "avalia-test-api-key",
    productId: "avalia",
    clientName: "avalia-test",
  }, { logger: noopLogger });
}

describe("AvaliaAdapter", () => {
  it("registers all 9 tools with valid schemas and readOnly hints", () => {
    const adapter = createAvaliaAdapter({ client: createClient("http://127.0.0.1:9999") });
    const registry = new ToolRegistry();
    adapter.register(registry);

    expect(registry.list()).toHaveLength(9);
    expect(registry.has("get_company_summary")).toBe(true);
    expect(registry.has("get_review_summary")).toBe(true);
    expect(registry.has("get_lead_summary")).toBe(true);
    expect(registry.has("get_sales_pipeline")).toBe(true);
    expect(registry.has("get_material_download_summary")).toBe(true);
    expect(registry.has("get_system_health")).toBe(true);
    expect(registry.has("get_subscription_summary")).toBe(true);
    expect(registry.has("get_usage_summary")).toBe(true);
    expect(registry.has("get_api_key_usage")).toBe(true);

    for (const tool of adapter.tools) {
      expect(tool.readOnly).toBe(true);
      expect(tool.riskLevel ?? "read").toBe("read");
    }
  });

  it("executes get_company_summary with schema validation", async () => {
    await withServer((req, res) => {
      if (req.url === "/api/v1/companies/comp-123/summary") {
        respondJson(res, 200, {
          data: {
            id: "comp-123",
            legal_name: "Solar Tech Brasil LTDA",
            trade_name: "SolarTech",
            stage: "active",
            plan_name: "Enterprise Solar",
            rating: 4.8,
            total_reviews: 142,
            total_leads: 530,
            active_pipeline_value: 1250000.5,
          },
        });
        return;
      }
      respondJson(res, 404, {});
    }, async (server) => {
      const adapter = createAvaliaAdapter({ client: createClient(server.baseUrl) });
      const tool = adapter.tools.find((t) => t.name === "get_company_summary")!;
      const context = createToolExecutionContext({ requestId: "req-comp", productId: "avalia" });

      const result = await tool.execute(context, { company_id: "comp-123" });
      expect(result).toMatchObject({
        id: "comp-123",
        legal_name: "Solar Tech Brasil LTDA",
        stage: "active",
        total_reviews: 142,
      });
    });
  });

  it("executes get_review_summary with score distribution and NPS", async () => {
    await withServer((req, res) => {
      if (req.url?.startsWith("/api/v1/reviews/summary")) {
        respondJson(res, 200, {
          data: {
            average_score: 4.6,
            total_reviews: 88,
            nps_score: 72,
            distribution: { "5": 60, "4": 20, "3": 5, "2": 2, "1": 1 },
            positive_sentiment_ratio: 0.91,
          },
        });
        return;
      }
      respondJson(res, 404, {});
    }, async (server) => {
      const adapter = createAvaliaAdapter({ client: createClient(server.baseUrl) });
      const tool = adapter.tools.find((t) => t.name === "get_review_summary")!;
      const context = createToolExecutionContext({ requestId: "req-rev", productId: "avalia" });

      const result = await tool.execute(context, { period: "30d" });
      expect(result).toMatchObject({
        average_score: 4.6,
        total_reviews: 88,
        nps_score: 72,
      });
    });
  });

  it("executes get_lead_summary with strict PII minimization", async () => {
    await withServer((req, res) => {
      if (req.url?.startsWith("/api/v1/leads/summary")) {
        respondJson(res, 200, {
          data: {
            total_leads: 120,
            qualified_leads: 45,
            conversion_rate: 0.375,
            by_source: { google_ads: 70, organic: 30, direct: 20 },
            by_stage: { contact: 60, proposal: 40, won: 20 },
            estimated_monthly_consumption_kwh: 45000,
          },
        });
        return;
      }
      respondJson(res, 404, {});
    }, async (server) => {
      const adapter = createAvaliaAdapter({ client: createClient(server.baseUrl) });
      const tool = adapter.tools.find((t) => t.name === "get_lead_summary")!;
      const context = createToolExecutionContext({ requestId: "req-lead", productId: "avalia" });

      const result = await tool.execute(context, { period: "7d" });
      expect(result).toMatchObject({
        total_leads: 120,
        qualified_leads: 45,
        conversion_rate: 0.375,
      });
    });
  });

  it("executes get_sales_pipeline and get_material_download_summary cleanly", async () => {
    await withServer((req, res) => {
      if (req.url?.startsWith("/api/v1/sales/pipeline")) {
        respondJson(res, 200, {
          data: {
            currency: "BRL",
            total_pipeline_value: 3500000,
            deals_count: 24,
            stages: [
              { stage_name: "Qualification", count: 10, value: 1000000, win_probability: 0.2 },
              { stage_name: "Proposal", count: 8, value: 1500000, win_probability: 0.5 },
              { stage_name: "Closing", count: 6, value: 1000000, win_probability: 0.8 },
            ],
          },
        });
        return;
      }
      if (req.url?.startsWith("/api/v1/materials/download-summary")) {
        respondJson(res, 200, {
          data: {
            total_downloads: 340,
            unique_leads: 210,
            top_materials: [
              { title: "Guia Solar Fotovoltaico 2026", download_count: 200, conversion_to_lead_rate: 0.45 },
            ],
          },
        });
        return;
      }
      respondJson(res, 404, {});
    }, async (server) => {
      const adapter = createAvaliaAdapter({ client: createClient(server.baseUrl) });
      const context = createToolExecutionContext({ requestId: "req-pipe", productId: "avalia" });

      const salesTool = adapter.tools.find((t) => t.name === "get_sales_pipeline")!;
      const salesResult = await salesTool.execute(context, {});
      expect(salesResult).toMatchObject({
        currency: "BRL",
        total_pipeline_value: 3500000,
        deals_count: 24,
      });

      const materialTool = adapter.tools.find((t) => t.name === "get_material_download_summary")!;
      const materialResult = await materialTool.execute(context, {});
      expect(materialResult).toMatchObject({
        total_downloads: 340,
        unique_leads: 210,
      });
    });
  });
});
