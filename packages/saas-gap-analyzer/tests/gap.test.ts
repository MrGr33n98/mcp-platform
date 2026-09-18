import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RepositoryScanner } from "@mcp-platform/repository-intelligence";
import { ArchitectureGraphBuilder } from "@mcp-platform/architecture-graph";
import { GapEngine } from "../src/gap-engine.js";
import { ReportGenerator } from "../src/report-generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MINIMAL_RAILS_DIR = path.resolve(__dirname, "../../repository-intelligence/fixtures/minimal-rails");
const BROKEN_TENANCY_DIR = path.resolve(__dirname, "../../repository-intelligence/fixtures/broken-tenancy");
const INVALID_ROOT_DIR = path.resolve(__dirname, "../../repository-intelligence/fixtures/invalid-root");

describe("SaaS Gap Analyzer & Report Generator", () => {
  it("audits repository against Golden SaaS blueprint with atomic requirements and evidence", async () => {
    const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const report = GapEngine.analyze(manifest, graph);

    expect(report.repository.name).toBe("minimal-rails");
    expect(report.validationStatus).toBe("VALID");
    expect(report.summary.total).toBe(11);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.scoreBreakdown).toBeDefined();
    expect(report.scoreBreakdown?.p0_security_tenancy).toBeGreaterThan(0);

    // Tenancy capability audit check
    const tenancyAudit = report.audits.find((a) => a.capabilityId === "tenancy");
    expect(tenancyAudit).toBeDefined();
    expect(tenancyAudit?.requirements.length).toBeGreaterThanOrEqual(4);
    expect(tenancyAudit?.requirements.some((r) => r.requirementId === "TEN-001" && r.status === "PASS")).toBe(true);

    // Admin capability audit check
    const adminAudit = report.audits.find((a) => a.capabilityId === "admin");
    expect(adminAudit).toBeDefined();
    expect(adminAudit?.status).toBe("PASS");

    // Webhooks capability (missing in minimal fixture)
    const webhooksAudit = report.audits.find((a) => a.capabilityId === "webhooks");
    expect(webhooksAudit).toBeDefined();
    expect(webhooksAudit?.status).toBe("MISSING");
  });

  it("strictly reports NOT_VERIFIED with null score when repository lacks Rails/Next structure", async () => {
    const manifest = await RepositoryScanner.scan(INVALID_ROOT_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const report = GapEngine.analyze(manifest, graph);

    expect(report.validationStatus).toBe("NOT_VERIFIED");
    expect(report.overallScore).toBeNull();
    expect(report.summary.not_verified).toBe(11);
    expect(report.factualExplanation).toContain("No detectable Rails or Next.js");

    const markdown = ReportGenerator.generateMarkdown(report);
    expect(markdown).toContain("NOT VERIFIED");
    expect(markdown).toContain("Factual Validation Notice");
  });

  it("detects missing tenancy scoping in broken-tenancy fixture without false passes", async () => {
    const manifest = await RepositoryScanner.scan(BROKEN_TENANCY_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const report = GapEngine.analyze(manifest, graph);

    const tenancyAudit = report.audits.find((a) => a.capabilityId === "tenancy");
    expect(tenancyAudit).toBeDefined();
    expect(tenancyAudit?.status).toBe("MISSING");
    
    const scopeReq = tenancyAudit?.requirements.find((r) => r.requirementId === "TEN-002");
    expect(scopeReq?.status).toBe("MISSING");
  });

  it("generates markdown report with summary table, requirement audit and breakdown", async () => {
    const manifest = await RepositoryScanner.scan(MINIMAL_RAILS_DIR);
    const graph = ArchitectureGraphBuilder.build(manifest);
    const report = GapEngine.analyze(manifest, graph);
    const markdown = ReportGenerator.generateMarkdown(report);

    expect(markdown).toContain("# Golden SaaS Capability Gap Report");
    expect(markdown).toContain("## Summary Matrix");
    expect(markdown).toContain("Multi-Tenancy, Memberships & RBAC");
    expect(markdown).toContain("Requirements Audit:");
    expect(markdown).toContain("TEN-001");
  });
});
