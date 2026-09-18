import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RepositoryScanner, ProductWorkspaceScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "../src/graph-builder.js";
import { ImpactAnalyzer } from "../src/impact-analyzer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MINIMAL_RAILS_DIR = path.resolve(__dirname, "../../repository-intelligence/fixtures/minimal-rails");
const RAILS_NEXT_SAAS_DIR = path.resolve(__dirname, "../../repository-intelligence/fixtures/rails-next-saas");

describe("Architecture Graph Builder & Impact Analyzer", () => {
  it("builds a high-confidence graph from repository manifest", async () => {
    const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);

    expect(graph.graphVersion).toBe(1);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(7);
    expect(graph.edges.length).toBeGreaterThanOrEqual(4);

    // Verify node types exist
    const nodeTypes = graph.nodes.map((n) => n.type);
    expect(nodeTypes).toContain("MODEL");
    expect(nodeTypes).toContain("TABLE");
    expect(nodeTypes).toContain("CONTROLLER");
    expect(nodeTypes).toContain("ROUTE");
    expect(nodeTypes).toContain("POLICY");
    expect(nodeTypes).toContain("ADMIN_RESOURCE");

    // Verify edges have confidence, evidence and unique edgeId
    for (const edge of graph.edges) {
      expect(edge.edgeId).toBeDefined();
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(edge.confidence);
      expect(edge.evidence.file).toBeDefined();
      expect(edge.evidence.reason).toBeDefined();
    }

    // Verify specific edges
    const persistsEdge = graph.edges.find((e) => e.type === "PERSISTS_TO" && e.source === "model:Organization");
    expect(persistsEdge).toBeDefined();
    expect(persistsEdge?.target).toBe("table:organizations");

    const authEdge = graph.edges.find((e) => e.type === "AUTHORIZES_WITH");
    expect(authEdge).toBeDefined();
    expect(authEdge?.source === "policy:MissionPolicy" || authEdge?.source.includes("controller")).toBe(true);
  });

  it("builds a combined graph from a multi-app ProductWorkspace", async () => {
    const workspace = await ProductWorkspaceScanner.scanWorkspace(RAILS_NEXT_SAAS_DIR);
    const graph = ArchitectureGraphBuilder.buildFromWorkspace(workspace);

    const nodeTypes = graph.nodes.map((n) => n.type);
    expect(nodeTypes).toContain("MODEL");
    expect(nodeTypes).toContain("CONTROLLER");
    expect(nodeTypes).toContain("NEXT_ROUTE");
    expect(nodeTypes).toContain("TEST_SPEC");

    // Verify test coverage edges exist
    const testEdges = graph.edges.filter((e) => e.type === "TESTS" || e.type === "COVERS");
    expect(testEdges.length).toBeGreaterThanOrEqual(2);
  });

  it("supports whyEdge query for evidence traceability", async () => {
    const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const analyzer = new ImpactAnalyzer(graph);

    const firstEdge = graph.edges[0];
    expect(firstEdge).toBeDefined();

    const evidence = analyzer.whyEdge(firstEdge.edgeId);
    expect(evidence).toBeDefined();
    expect(evidence?.file).toBe(firstEdge.evidence.file);
    expect(evidence?.reason).toBe(firstEdge.evidence.reason);
  });

  it("queries what tests protect an architecture component", async () => {
    const workspace = await ProductWorkspaceScanner.scanWorkspace(RAILS_NEXT_SAAS_DIR);
    const graph = ArchitectureGraphBuilder.buildFromWorkspace(workspace);
    const analyzer = new ImpactAnalyzer(graph);

    // What tests protect User model?
    const userTests = analyzer.whatTestsProtectComponent("model:User");
    expect(userTests.length).toBeGreaterThanOrEqual(1);
    expect(userTests[0].file).toContain("user_spec.rb");

    // What tests protect MissionPolicy?
    const policyTests = analyzer.whatTestsProtectComponent("policy:MissionPolicy");
    expect(policyTests.length).toBeGreaterThanOrEqual(1);
    expect(policyTests[0].file).toContain("mission_policy_spec.rb");
  });

  it("performs downstream and upstream impact analysis accurately", async () => {
    const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const analyzer = new ImpactAnalyzer(graph);

    // What uses Organization model?
    const orgUsers = analyzer.whatUsesModel("Organization");
    expect(orgUsers.some((u) => u.id === "admin:Organization" || u.id === "model:Mission")).toBe(true);

    // What tables are affected by Mission?
    const tables = analyzer.whatTablesAreAffected("Mission");
    expect(tables.some((t) => t.id === "table:missions")).toBe(true);
  });
});
