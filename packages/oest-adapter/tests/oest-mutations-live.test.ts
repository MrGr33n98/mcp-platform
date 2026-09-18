import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
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
  project_a_id: string;
  key_a_secret: string;
  key_limited_secret: string;
  key_revoked_secret: string;
  org_b_id: string;
  org_b_name: string;
  mission_b_id: string;
  mission_b_title: string;
  project_b_id: string;
  key_b_secret: string;
}

const fixturesPath = "C:/Users/Bobi/.gemini/antigravity-ide/brain/9e26cb5e-d48c-484c-8f96-18b0e791f2a3/scratch/dev_fixtures_env.json";
const BASE_URL = "http://localhost:3001";

describe("OEST Operational Tools & Mutation Safety Gate (Live Rails 8.0.5)", { timeout: 30000 }, () => {
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
      clientName: "oest-mcp-gate-mutations",
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
      MCP_VERSION: "0.1.0-gate",
      MCP_LOG_LEVEL: "warn",
    });
    registry.register(createPlatformInfoTool(config));
    adapter.register(registry);

    const context = createToolExecutionContext({
      productId: "oest",
      scopes: ["mcp:read", "mcp:write"],
    });

    return registry.execute(name, input, context);
  }

  describe("Section 1: Risk Classification & Declaration", () => {
    it("declares write and sensitive riskLevels for operational tools", () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      const createMission = adapter.tools.find((t) => t.name === "create_mission");
      expect(createMission?.readOnly).toBe(false);
      expect(createMission?.riskLevel).toBe("write");

      const publishMission = adapter.tools.find((t) => t.name === "publish_mission");
      expect(publishMission?.readOnly).toBe(false);
      expect(publishMission?.riskLevel).toBe("write");

      const updateOrder = adapter.tools.find((t) => t.name === "update_order");
      expect(updateOrder?.readOnly).toBe(false);
      expect(updateOrder?.riskLevel).toBe("write");

      const cancelOrder = adapter.tools.find((t) => t.name === "cancel_order");
      expect(cancelOrder?.readOnly).toBe(false);
      expect(cancelOrder?.riskLevel).toBe("sensitive");
    });
  });

  describe("Section 2: Legitimate Mutations (Tenant A)", () => {
    let createdMissionId: string;

    it("creates a new mission draft via create_mission (POST /api/v1/missions)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      const result = (await executeTool(adapter, "create_mission", {
        project_id: fixtures.project_a_id,
        title: "Phase 5D Automated Field Inspection",
        description: "Created via MCP Operational Gate",
        mission_type: "inspection",
        priority: "normal",
        budget: {
          min: 1500,
          max: 4500,
          currency: "BRL",
        },
      })) as { id: string; title: string; status: string };

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Phase 5D Automated Field Inspection");
      expect(result.status).toBe("draft");

      createdMissionId = result.id;
    });

    it("supports idempotency key on create_mission", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      const result = (await executeTool(adapter, "create_mission", {
        project_id: fixtures.project_a_id,
        title: "Idempotent Mission Run",
        idempotency_key: "idem-unique-key-phase5d-001",
      })) as { id: string; title: string; status: string };

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.title).toBe("Idempotent Mission Run");
    });

    it("updates order details via update_order (PATCH /api/v1/enterprise/orders/:id)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      const result = (await executeTool(adapter, "update_order", {
        id: fixtures.mission_a_id,
        description: "Updated flight perimeter specifications via MCP",
      })) as { id: string; description?: string };

      expect(result).toBeDefined();
      expect(result.id).toBe(fixtures.mission_a_id);
    });

    it("cancels an order via cancel_order (POST /api/v1/enterprise/orders/:id/cancel)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      const targetToCancel = createdMissionId ?? ((await executeTool(adapter, "create_mission", {
        project_id: fixtures.project_a_id,
        title: "Mission To Cancel Test",
      })) as { id: string }).id;

      const result = (await executeTool(adapter, "cancel_order", {
        id: targetToCancel,
        reason: "Cancelled by integration safety gate test",
      })) as { id: string; status: string };

      expect(result).toBeDefined();
      expect(result.id).toBe(targetToCancel);
      expect(result.status).toBe("cancelled");
    });
  });

  describe("Section 3: Cross-Tenant Mutation Isolation Gate (Mandatory)", () => {
    it("blocks Tenant A from creating a mission inside Tenant B's project (404 / RAILS_API_NOT_FOUND)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      await expect(
        executeTool(adapter, "create_mission", {
          project_id: fixtures.project_b_id,
          title: "Malicious Cross-Tenant Mission Attempt",
        }),
      ).rejects.toThrowError(McpPlatformError);

      try {
        await executeTool(adapter, "create_mission", {
          project_id: fixtures.project_b_id,
          title: "Malicious Cross-Tenant Mission Attempt",
        });
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_NOT_FOUND");
      }
    });

    it("blocks Tenant A from cancelling Tenant B's order (404 / RAILS_API_NOT_FOUND)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      try {
        await executeTool(adapter, "cancel_order", {
          id: fixtures.mission_b_id,
          reason: "Unauthorized cancel attempt",
        });
        expect.unreachable("Should have thrown 404");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_NOT_FOUND");
      }
    });

    it("blocks Tenant A from updating Tenant B's order (404 / RAILS_API_NOT_FOUND)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      try {
        await executeTool(adapter, "update_order", {
          id: fixtures.mission_b_id,
          description: "Unauthorized update attempt",
        });
        expect.unreachable("Should have thrown 404");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_NOT_FOUND");
      }
    });

    it("blocks Tenant B from cancelling Tenant A's order (404 / RAILS_API_NOT_FOUND)", async () => {
      const adapter = createLiveAdapter(fixtures.key_b_secret);

      try {
        await executeTool(adapter, "cancel_order", {
          id: fixtures.mission_a_id,
          reason: "Unauthorized cross-tenant cancel from B",
        });
        expect.unreachable("Should have thrown 404");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_NOT_FOUND");
      }
    });
  });

  describe("Section 4: Authentication & Domain Validation Failures", () => {
    it("blocks unauthenticated mutation calls (401 / RAILS_API_UNAUTHORIZED)", async () => {
      const adapter = createLiveAdapter("dh_live_invalid_secret_token_12345");

      try {
        await executeTool(adapter, "create_mission", {
          project_id: fixtures.project_a_id,
          title: "Unauthenticated Mission",
        });
        expect.unreachable("Should have thrown 401");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_UNAUTHORIZED");
      }
    });

    it("blocks revoked API key mutation calls (401 / RAILS_API_UNAUTHORIZED)", async () => {
      const adapter = createLiveAdapter(fixtures.key_revoked_secret);

      try {
        await executeTool(adapter, "create_mission", {
          project_id: fixtures.project_a_id,
          title: "Revoked Key Mission",
        });
        expect.unreachable("Should have thrown 401");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_UNAUTHORIZED");
      }
    });

    it("maps domain validation failure (unpublishable draft) to RAILS_API_UNPROCESSABLE (422)", async () => {
      const adapter = createLiveAdapter(fixtures.key_a_secret);

      // Create incomplete draft
      const draft = (await executeTool(adapter, "create_mission", {
        project_id: fixtures.project_a_id,
        title: "Incomplete Draft for Publish Gate",
      })) as { id: string };

      try {
        // Attempting to publish without AOI / products / deadline
        await executeTool(adapter, "publish_mission", { id: draft.id });
        expect.unreachable("Should have thrown 422");
      } catch (err) {
        const mcpErr = err as McpPlatformError;
        expect(mcpErr.code).toBe("RAILS_API_UNPROCESSABLE");
      }
    });
  });
});
