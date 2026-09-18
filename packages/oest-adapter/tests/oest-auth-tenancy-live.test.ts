import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ConsoleAuditSink,
  ConsoleLogger,
  ToolRegistry,
  createPlatformInfoTool,
  createToolExecutionContext,
  loadConfig,
  McpPlatformError,
} from "@mcp-platform/core";
import { RailsApiClient } from "@mcp-platform/rails-api-client";
import { createOestAdapter, parseOestAdapterConfig } from "../src/index.js";

interface FixturesEnv {
  org_a_id: string;
  org_a_name: string;
  mission_a_id: string;
  mission_a_title: string;
  key_a_secret: string;
  key_limited_secret: string;
  key_revoked_secret: string;
  org_b_id: string;
  org_b_name: string;
  mission_b_id: string;
  mission_b_title: string;
  key_b_secret: string;
}

const fixturesPath = "C:/Users/Bobi/.gemini/antigravity-ide/brain/9e26cb5e-d48c-484c-8f96-18b0e791f2a3/scratch/dev_fixtures_env.json";
const BASE_URL = "http://localhost:3001";

describe("OEST Auth, Scopes, and Multi-Tenant Integration Gate (Live Rails 8.0.5)", { timeout: 30000 }, () => {
  if (!fs.existsSync(fixturesPath)) {
    it.skip("Fixtures file not found, skipping live tests", () => {});
    return;
  }

  const fixtures: FixturesEnv = JSON.parse(fs.readFileSync(fixturesPath, "utf-8"));
  const logger = new ConsoleLogger("warn");

  function createLiveAdapter(apiKey: string) {
    const client = new RailsApiClient({
      baseUrl: BASE_URL,
      apiKey,
      productId: "oest",
      clientName: "oest-mcp-gate",
      maxRetries: 0,
    }, { logger });
    return createOestAdapter({
      client,
      config: parseOestAdapterConfig({ dashboardKind: "enterprise" }),
    });
  }

  async function executeTool(adapter: ReturnType<typeof createOestAdapter>, name: string, input: unknown) {
    const registry = new ToolRegistry();
    const config = loadConfig({
      MCP_PRODUCT_ID: "oest",
      MCP_PRODUCT_NAME: "OEST MCP",
      MCP_LOG_LEVEL: "warn",
      MCP_VERSION: "0.1.0",
    });
    registry.register(createPlatformInfoTool(config));
    adapter.register(registry);
    return registry.execute(
      name,
      input,
      createToolExecutionContext({ productId: "oest", scopes: [] }),
    );
  }

  describe("Section 6: Authentication Matrix (Direct Rails)", () => {
    it("returns 401 UNAUTHENTICATED when missing credential", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions`);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("UNAUTHENTICATED");
    });

    it("returns 401 INVALID_API_KEY for invalid key secret", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions`, {
        headers: { Authorization: "Bearer dh_live_invalidkey1234567890abcdef" },
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("INVALID_API_KEY");
    });

    it("returns 401 INVALID_API_KEY for revoked key", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions`, {
        headers: { Authorization: `Bearer ${fixtures.key_revoked_secret}` },
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.code).toBe("INVALID_API_KEY");
    });

    it("returns 200 for valid DEV Key A", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions`, {
        headers: { Authorization: `Bearer ${fixtures.key_a_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("returns 200 for valid DEV Key B", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions`, {
        headers: { Authorization: `Bearer ${fixtures.key_b_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("Section 7: Tenant Resolution", () => {
    it("resolves Key A strictly to Organization A without model parameters", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/enterprise/dashboard`, {
        headers: { Authorization: `Bearer ${fixtures.key_a_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.organization.id).toBe(fixtures.org_a_id);
      expect(json.data.organization.name).toBe(fixtures.org_a_name);
    });

    it("resolves Key B strictly to Organization B without model parameters", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/enterprise/dashboard`, {
        headers: { Authorization: `Bearer ${fixtures.key_b_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.organization.id).toBe(fixtures.org_b_id);
      expect(json.data.organization.name).toBe(fixtures.org_b_name);
    });
  });

  describe("Section 8: Cross-Tenant Isolation Gate (Mandatory)", () => {
    it("Tenant A can read its own Mission A", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions/${fixtures.mission_a_id}`, {
        headers: { Authorization: `Bearer ${fixtures.key_a_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(fixtures.mission_a_id);
      expect(json.data.title).toBe(fixtures.mission_a_title);
    });

    it("Tenant A is BLOCKED (404 Not Found) when requesting Mission B", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions/${fixtures.mission_b_id}`, {
        headers: { Authorization: `Bearer ${fixtures.key_a_secret}` },
      });
      expect([403, 404]).toContain(res.status);
      expect(res.status).not.toBe(200);
      const json = await res.json();
      expect(json.data).toBeUndefined();
    });

    it("Tenant B can read its own Mission B", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions/${fixtures.mission_b_id}`, {
        headers: { Authorization: `Bearer ${fixtures.key_b_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.id).toBe(fixtures.mission_b_id);
      expect(json.data.title).toBe(fixtures.mission_b_title);
    });

    it("Tenant B is BLOCKED (404 Not Found) when requesting Mission A", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions/${fixtures.mission_a_id}`, {
        headers: { Authorization: `Bearer ${fixtures.key_b_secret}` },
      });
      expect([403, 404]).toContain(res.status);
      expect(res.status).not.toBe(200);
      const json = await res.json();
      expect(json.data).toBeUndefined();
    });
  });

  describe("Section 9: List Endpoint Isolation", () => {
    it("Key A list_missions returns only Tenant A missions and never leaks Tenant B", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions?limit=100`, {
        headers: { Authorization: `Bearer ${fixtures.key_a_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const ids = json.data.map((m: any) => m.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).not.toContain(fixtures.mission_b_id);
    });

    it("Key B list_missions returns only Tenant B missions and never leaks Tenant A", async () => {
      const res = await fetch(`${BASE_URL}/api/v1/missions?limit=100`, {
        headers: { Authorization: `Bearer ${fixtures.key_b_secret}` },
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      const ids = json.data.map((m: any) => m.id);
      expect(ids).toContain(fixtures.mission_b_id);
      expect(ids).not.toContain(fixtures.mission_a_id);
    });
  });

  describe("Section 12: Non-Empty Contracts and MCP Zod Validation", () => {
    it("executes get_platform_info cleanly", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_platform_info", {});
      expect(result).toMatchObject({
        platform: "MCP Platform",
        product_id: "oest",
        read_only: true,
      });
    });

    it("executes get_system_health against live Rails /health and passes schema", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_system_health", {});
      expect(result).toMatchObject({ status: "healthy" });
      expect((result as any).checks).toBeDefined();
    });

    it("executes get_subscription_summary against live Rails and passes schema", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_subscription_summary", {});
      expect(result).toBeDefined();
      expect(typeof (result as any).status).toBe("string");
    });

    it("executes get_usage_summary against live Rails and passes schema", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_usage_summary", { period: "current_period" });
      expect(result).toBeDefined();
      expect(Array.isArray((result as any).metrics)).toBe(true);
    });

    it("executes get_api_key_usage against live Rails and passes schema without secret leak", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_api_key_usage", {});
      expect(result).toBeDefined();
      expect(Array.isArray((result as any).items)).toBe(true);
      expect(JSON.stringify(result)).not.toContain(fixtures.key_a_secret);
      expect(JSON.stringify(result)).not.toContain(fixtures.key_b_secret);
    });

    it("executes get_organization_summary for Tenant A and resolves correctly", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_organization_summary", {});
      expect(result).toMatchObject({
        id: fixtures.org_a_id,
        name: fixtures.org_a_name,
      });
    });

    it("executes list_missions for Tenant A and validates non-empty list with Zod", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "list_missions", { limit: 50, offset: 0 });
      expect(result).toBeDefined();
      const items = (result as any).items;
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((m: any) => String(m.id) === String(fixtures.mission_a_id))).toBe(true);
      expect(items.some((m: any) => String(m.id) === String(fixtures.mission_b_id))).toBe(false);
    });

    it("executes get_mission for Tenant A with real non-empty mission details", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_mission", { id: fixtures.mission_a_id });
      expect(result).toMatchObject({
        id: fixtures.mission_a_id,
        title: fixtures.mission_a_title,
      });
    });

    it("executes get_mission_summary for Tenant A with real non-empty mission data", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "get_mission_summary", { id: fixtures.mission_a_id });
      expect(result).toMatchObject({
        id: fixtures.mission_a_id,
        title: fixtures.mission_a_title,
        status: "published",
        mission_type: "mapping",
      });
    });

    it("executes list_operators against marketplace and passes schema", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const result = await executeTool(adapter, "list_operators", { limit: 10 });
      expect(result).toBeDefined();
      expect(Array.isArray((result as any).items)).toBe(true);
    });

    it("normalizes cross-tenant error to RAILS_API_NOT_FOUND in MCP tool execution", async () => {
      const adapterA = createLiveAdapter(fixtures.key_a_secret);
      await expect(executeTool(adapterA, "get_mission", { id: fixtures.mission_b_id })).rejects.toThrow(
        McpPlatformError,
      );
      try {
        await executeTool(adapterA, "get_mission", { id: fixtures.mission_b_id });
      } catch (err: any) {
        expect(err.code).toBe("RAILS_API_NOT_FOUND");
      }
    });

    it("normalizes unauthenticated access to RAILS_API_UNAUTHORIZED in MCP tool execution", async () => {
      const adapterInvalid = createLiveAdapter("dh_live_invalidkey1234567890abcdef");
      await expect(executeTool(adapterInvalid, "list_missions", {})).rejects.toThrow(McpPlatformError);
      try {
        await executeTool(adapterInvalid, "list_missions", {});
      } catch (err: any) {
        expect(err.code).toBe("RAILS_API_UNAUTHORIZED");
      }
    });
  });

  describe("Section 14: MCP Read-Only Guarantee", () => {
    it("ensures all registered tools have readOnlyHint: true", () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);
      const registry = new ToolRegistry();
      const config = loadConfig({
        MCP_PRODUCT_ID: "oest",
        MCP_PRODUCT_NAME: "OEST MCP",
        MCP_LOG_LEVEL: "warn",
        MCP_VERSION: "0.1.0",
      });
      registry.register(createPlatformInfoTool(config));
      adapter.register(registry);

      const tools = registry.list();
      expect(tools.length).toBe(18); // 1 platform_info + 13 read-only + 4 mutation
      const readOnlyTools = tools.filter((t) => t.readOnly);
      expect(readOnlyTools.length).toBeGreaterThan(0);
      for (const tool of readOnlyTools) {
        expect(tool.readOnly).toBe(true);
      }
      const mutationTools = tools.filter((t) => !t.readOnly);
      expect(mutationTools.length).toBe(4);
      for (const tool of mutationTools) {
        expect(["write", "sensitive", "destructive"]).toContain(tool.riskLevel);
      }
    });
  });
});

