import { describe, it, expect } from "vitest";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { GapReport } from "@mcp-platform/saas-gap-analyzer";
import { FeatureEngineeringEngine } from "../src/feature-engineering-engine.js";

function createMockManifest(): RepositoryManifest {
  return {
    manifestVersion: 1,
    scannedAt: new Date().toISOString(),
    validation: {
      status: "VALID",
      workspace_type: "SINGLE_APP",
      repository_root: "/fake/repo",
      backend_roots: ["/fake/repo"],
      frontend_roots: [],
      nested_apps: [],
      evidence: []
    },
    scanCoverage: {
      files_discovered: 10,
      files_scanned: 10,
      files_skipped: 0,
      parse_failures: 0,
      unsupported_files: 0,
      coverage_confidence: "HIGH",
      limitations: []
    },
    repository: { path: "/fake/repo", name: "oest" },
    stack: {
      backend: "rails",
      frontend: "nextjs",
      database: "postgres",
      postgis: false,
      queue: "sidekiq",
      storage: "active_storage"
    },
    versions: { rails: "8.0.5" },
    backend: {
      framework: "rails",
      routes: [],
      models: [
        { name: "Organization", tableName: "organizations", file: "app/models/organization.rb", associations: [], attributes: [], isTenantScoped: false },
        { name: "Mission", tableName: "missions", file: "app/models/mission.rb", associations: [], attributes: [], isTenantScoped: true }
      ],
      controllers: [
        { name: "Api::V1::BaseController", file: "app/controllers/api/v1/base_controller.rb", actions: [], tenantScoped: true }
      ],
      policies: [
        { name: "ApplicationPolicy", file: "app/policies/application_policy.rb", model: "Application", actions: [] }
      ],
      services: [],
      jobs: [
        { name: "ApplicationJob", file: "app/jobs/application_job.rb", queue: "default" }
      ],
      mailers: [],
      adminResources: [
        { name: "Mission", file: "app/admin/missions.rb", model: "Mission" }
      ],
      initializers: []
    },
    frontend: {
      framework: "nextjs",
      appRouter: true,
      pagesRouter: false,
      routes: [{ path: "app/(dashboard)/settings/page.tsx", file: "app/(dashboard)/settings/page.tsx", type: "page" }],
      components: [],
      hooks: [],
      uiLibrary: "tailwind",
      styling: []
    },
    database: {
      type: "postgres",
      postgis: false,
      tables: [{ name: "organizations", columns: [{ name: "id", type: "uuid" }], indexes: [] }],
      migrations: []
    },
    background_jobs: { runner: "sidekiq", queues: ["default"], jobs: ["ApplicationJob"] },
    storage: { provider: "local", activeStorage: true, s3Compatible: false },
    auth: { mechanisms: ["api_key"], mfa: false, oauth: [], apiKeys: true },
    admin: { type: "active_admin", resources: ["Mission"] },
    tests: {
      frameworks: ["rspec"],
      specCount: 1,
      testPaths: ["spec/models/organization_spec.rb"],
      specs: [
        {
          file: "spec/models/organization_spec.rb",
          type: "model",
          targetComponent: "Organization",
          evidence: {
            file: "spec/models/organization_spec.rb",
            evidence_type: "TEST",
            confidence: "HIGH",
            description: "Organization model spec"
          }
        }
      ]
    },
    infra: { docker: false, compose: false, githubActions: false, workflows: [] },
    security: { secretFindings: [], unsafeFilesBlocked: [] },
    unknowns: []
  };
}

describe("FeatureEngineeringEngine (Phase 5E)", () => {
  const sampleManifest = createMockManifest();

  const sampleGraph: ArchitectureGraphData = {
    graphVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes: [
      { id: "model:Organization", type: "MODEL", name: "Organization", file: "app/models/organization.rb" },
      { id: "controller:Api::V1::BaseController", type: "CONTROLLER", name: "Api::V1::BaseController", file: "app/controllers/api/v1/base_controller.rb" }
    ],
    edges: []
  };

  const sampleGapReport: GapReport = {
    generatedAt: new Date().toISOString(),
    repository: { path: "/fake/repo", name: "oest" },
    validationStatus: "VALID",
    overallScore: 75,
    summary: { total: 1, pass: 0, partial: 0, missing: 1, fail: 0, not_verified: 0, not_applicable: 0 },
    audits: [
      {
        capabilityId: "webhooks",
        name: "Outgoing Webhooks",
        status: "MISSING",
        priority: "P2",
        evidencePaths: [],
        evidence: [],
        requirements: [],
        existingImplementation: "None",
        missingPieces: ["WebhookEndpoint", "DeliverPayloadJob"],
        securityGaps: ["SSRF", "HMAC"],
        testGaps: ["Specs"],
        dependencies: ["tenancy"]
      }
    ]
  };

  it("plans a complete vertical slice for Outgoing Webhooks in PLAN_ONLY mode", () => {
    const result = FeatureEngineeringEngine.plan(
      sampleManifest,
      sampleGraph,
      sampleGapReport,
      { productName: "oest", targetCapability: "webhooks" }
    );

    // 1. VerticalSlicePlan Checks
    const { verticalSlicePlan, changePlan, markdownReport } = result;
    expect(verticalSlicePlan.capability).toBe("webhooks");
    expect(verticalSlicePlan.title).toBe("Outgoing Webhooks");
    expect(verticalSlicePlan.models.length).toBe(3);
    expect(verticalSlicePlan.models.map((m) => m.name)).toEqual(["WebhookEndpoint", "WebhookDelivery", "WebhookAttempt"]);
    expect(verticalSlicePlan.policies.length).toBe(1);
    expect(verticalSlicePlan.services.length).toBe(3);
    expect(verticalSlicePlan.jobs.length).toBe(1);
    expect(verticalSlicePlan.controllers.length).toBe(1);
    expect(verticalSlicePlan.tests.length).toBe(5);
    expect(verticalSlicePlan.tests.map((t) => t.category)).toEqual([
      "MODEL_SPEC",
      "REQUEST_SPEC",
      "CROSS_TENANT_SPEC",
      "SERVICE_SPEC",
      "JOB_SPEC"
    ]);

    // 2. Machine-Readable ChangePlan Checks
    expect(changePlan.schema_version).toBe(1);
    expect(changePlan.mode).toBe("PLAN_ONLY");
    expect(changePlan.product).toBe("oest");
    expect(changePlan.capability).toBe("webhooks");
    expect(changePlan.approval_required).toBe(true);
    expect(changePlan.operations.length).toBeGreaterThan(10);
    expect(changePlan.verification.length).toBeGreaterThan(0);
    expect(changePlan.rollback.length).toBeGreaterThan(0);

    // 3. Human-Verifiable Markdown Document Checks
    expect(markdownReport).toContain("# VERTICAL SLICE ENGINEERING PLAN");
    expect(markdownReport).toContain("Outgoing Webhooks");
    expect(markdownReport).toContain("NO EVIDENCE → NO CHANGE");
    expect(markdownReport).toContain("NO TEST PLAN → NO CHANGE");
    expect(markdownReport).toContain("NO ROLLBACK PLAN → NO MIGRATION");
    expect(markdownReport).toContain("NO POLICY → NO TENANT-SCOPED ENDPOINT");
    expect(markdownReport).toContain("NO HUMAN APPROVAL → NO WRITE");
    expect(markdownReport).toContain("HUMAN APPROVAL REQUIRED BEFORE WRITE");
  });
});
