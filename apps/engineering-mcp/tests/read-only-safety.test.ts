import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ToolRegistry, createToolExecutionContext } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";

describe("Engineering MCP Read-Only Tools Safety", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-readonly-test-"));
    await fs.mkdir(path.join(tempDir, "config"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "app", "models"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "app", "controllers"), { recursive: true });
    await fs.mkdir(path.join(tempDir, "db"), { recursive: true });

    await fs.writeFile(path.join(tempDir, "Gemfile"), 'source "https://rubygems.org"\ngem "rails"\n');
    await fs.writeFile(path.join(tempDir, "config", "routes.rb"), "Rails.application.routes.draw do\n  resources :users\nend\n");
    await fs.writeFile(path.join(tempDir, "db", "schema.rb"), 'ActiveRecord::Schema.define(version: 2023_01_01) do\n  create_table "users" do |t|\n    t.string "name"\n  end\nend\n');
    await fs.writeFile(path.join(tempDir, "app", "models", "user.rb"), "class User < ApplicationRecord\n  belongs_to :organization\nend\n");
    await fs.writeFile(path.join(tempDir, "app", "controllers", "users_controller.rb"), "class UsersController < ApplicationController\n  def index; end\nend\n");
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  async function getDirSnapshot(dir: string): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    async function walk(d: string) {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else if (e.isFile()) {
          const stat = await fs.stat(full);
          map.set(path.relative(dir, full), stat.mtimeMs);
        }
      }
    }
    await walk(dir);
    return map;
  }

  it("read-only tools do not mutate repository files", async () => {
    const beforeSnap = await getDirSnapshot(tempDir);

    // 1. Scan
    await registry.execute("engineering_scan_repository", { repository_path: tempDir }, context);

    // 2. Evidence
    await registry.execute("engineering_get_repository_evidence", { repository_path: tempDir }, context);

    // 3. Graph
    await registry.execute("engineering_build_architecture_graph", { repository_path: tempDir }, context);

    // 4. Gap Analysis
    await registry.execute("engineering_analyze_saas_gaps", { repository_path: tempDir }, context);

    // 5. Plan Feature
    await registry.execute("engineering_plan_feature", { repository_path: tempDir, target_capability: "tenancy" }, context);

    // 6. Blast Radius
    await registry.execute("engineering_analyze_blast_radius", { repository_path: tempDir }, context);

    // 7. Platform Info
    await registry.execute("engineering_get_platform_info", {}, context);

    // 8. List capabilities
    await registry.execute("engineering_list_capabilities", {}, context);

    // 9. Diagnostics
    await registry.execute("engineering_diagnose_production", { environment: "test", product_name: "test", repository_path: tempDir }, context);

    const afterSnap = await getDirSnapshot(tempDir);

    expect(afterSnap.size).toBe(beforeSnap.size);
    for (const [file, mtime] of beforeSnap.entries()) {
      expect(afterSnap.get(file)).toBe(mtime);
    }
  });
});
