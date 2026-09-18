import { describe, expect, it } from "vitest";
import {
  ConsoleLogger,
  MetricsCollector,
  ToolRegistry,
  createHttpServer,
  createPlatformInfoTool,
  emptyObjectSchema,
  loadConfig,
  type ToolDefinition,
} from "../src/index.js";

function createConfig() {
  return loadConfig({
    MCP_PRODUCT_ID: "test-product",
    MCP_PRODUCT_NAME: "Test Product",
    MCP_VERSION: "0.1.0",
  });
}

function createDummyTool(): ToolDefinition<typeof emptyObjectSchema> {
  return {
    name: "ping",
    description: "Ping tool for HTTP testing",
    readOnly: true,
    riskLevel: "read",
    inputSchema: emptyObjectSchema,
    execute() {
      return { message: "pong" };
    },
  };
}

describe("Streamable HTTP Server", () => {
  it("starts HTTP server, serves /health and /metrics with authentication", async () => {
    const config = createConfig();
    const registry = new ToolRegistry();
    registry.register(createPlatformInfoTool(config));
    registry.register(createDummyTool());

    const metrics = new MetricsCollector();
    const logger = new ConsoleLogger("error");

    const httpServer = createHttpServer({
      config,
      registry,
      logger,
      metrics,
      authToken: "secret-token-123",
      allowedOrigins: ["http://localhost:3000"],
    });

    const { port, host } = await httpServer.listen();

    try {
      // 1. Health endpoint (public)
      const healthRes = await fetch(`http://${host}:${port}/health`);
      expect(healthRes.status).toBe(200);
      const healthData = await healthRes.json();
      expect(healthData).toEqual({ status: "healthy", product: "test-product" });

      // 2. Metrics endpoint (unauthorized)
      const unauthMetricsRes = await fetch(`http://${host}:${port}/metrics`);
      expect(unauthMetricsRes.status).toBe(401);

      // 3. Metrics endpoint (authorized)
      const authMetricsRes = await fetch(`http://${host}:${port}/metrics`, {
        headers: { Authorization: "Bearer secret-token-123" },
      });
      expect(authMetricsRes.status).toBe(200);

      // 4. SSE Handshake
      const sseRes = await fetch(`http://${host}:${port}/sse`, {
        headers: { Authorization: "Bearer secret-token-123" },
      });
      expect(sseRes.status).toBe(200);
      expect(sseRes.headers.get("content-type")).toContain("text/event-stream");

      // 5. POST message tools/call
      const callRes = await fetch(`http://${host}:${port}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token-123",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            name: "ping",
            arguments: {},
          },
        }),
      });
      expect(callRes.status).toBe(200);
      const callData = await callRes.json();
      expect(callData.result.isError).toBe(false);
      expect(callData.result.content[0].text).toContain("pong");

      // 6. Tools list
      const listRes = await fetch(`http://${host}:${port}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer secret-token-123",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/list",
        }),
      });
      expect(listRes.status).toBe(200);
      const listData = await listRes.json();
      expect(listData.result.tools.some((t: any) => t.name === "ping")).toBe(true);
    } finally {
      await httpServer.close();
    }
  });
});
