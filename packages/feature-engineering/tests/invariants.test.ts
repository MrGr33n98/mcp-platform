import { describe, it, expect } from "vitest";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { GapReport } from "@mcp-platform/saas-gap-analyzer";
import { VerticalSlicePlanner } from "../src/vertical-slice-planner.js";
import { TestPlanner } from "../src/test-planner.js";
import { MigrationPlanner } from "../src/migration-planner.js";
import { PolicyPlanner } from "../src/policy-planner.js";

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
    repository: { path: "/fake/repo", name: "test-saas" },
    stack: {
      backend: "rails",
      frontend: "none",
      database: "postgres",
      postgis: false,
      queue: "sidekiq",
      storage: "active_storage"
    },
    versions: { rails: "8.0.5" },
    backend: {
      framework: "rails",
      routes: [],
      models: [{ name: "Organization", tableName: "organizations", file: "app/models/organization.rb", associations: [], attributes: [], isTenantScoped: false }],
      controllers: [{ name: "Api::V1::BaseController", file: "app/controllers/api/v1/base_controller.rb", actions: [], tenantScoped: true }],
      policies: [{ name: "ApplicationPolicy", file: "app/policies/application_policy.rb", model: "Application", actions: [] }],
      services: [],
      jobs: [{ name: "ApplicationJob", file: "app/jobs/application_job.rb", queue: "default" }],
      mailers: [],
      adminResources: [],
      initializers: []
    },
    frontend: {
      framework: "none",
      appRouter: false,
      pagesRouter: false,
      routes: [],
      components: [],
      hooks: [],
      uiLibrary: "none",
      styling: []
    },
    database: {
      type: "postgres",
      postgis: false,
      tables: [{ name: "organizations", columns: [{ name: "id", type: "uuid" }], indexes: [] }],
      migrations: []
    },
    background_jobs: { runner: "sidekiq", queues: ["default"], jobs: [] },
    storage: { provider: "local", activeStorage: true, s3Compatible: false },
    auth: { mechanisms: ["api_key"], mfa: false, oauth: [], apiKeys: true },
    admin: { type: "none", resources: [] },
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

describe("Invariant Principles Enforcement", () => {
  const sampleManifest = createMockManifest();

  const sampleGraph: ArchitectureGraphData = {
    graphVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes: [
      { id: "model:Organization", type: "MODEL", name: "Organization", file: "app/models/organization.rb" }
    ],
    edges: []
  };

  const sampleGapReport: GapReport = {
    generatedAt: new Date().toISOString(),
    repository: { path: "/fake/repo", name: "test-saas" },
    validationStatus: "VALID",
    overallScore: 60,
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
        missingPieces: ["WebhookEndpoint"],
        securityGaps: ["SSRF"],
        testGaps: ["Unit tests"],
        dependencies: ["tenancy"]
      }
    ]
  };

  it("passes all invariant checks for a complete vertical slice", () => {
    const plan = VerticalSlicePlanner.plan(sampleManifest, sampleGraph, sampleGapReport, "webhooks");
    expect(plan.capability).toBe("webhooks");
    expect(plan.tests.length).toBeGreaterThan(0);
    expect(plan.rollbackPlan.safeRollbackGuaranteed).toBe(true);
    expect(plan.policies.length).toBeGreaterThan(0);
  });

  it("enforces NO TEST PLAN -> NO CHANGE", () => {
    const originalPlanTests = TestPlanner.planTests;
    TestPlanner.planTests = () => [];

    try {
      expect(() => {
        VerticalSlicePlanner.plan(sampleManifest, sampleGraph, sampleGapReport, "webhooks");
      }).toThrow(/NO TEST PLAN -> NO CHANGE/);
    } finally {
      TestPlanner.planTests = originalPlanTests;
    }
  });

  it("enforces NO ROLLBACK PLAN -> NO MIGRATION", () => {
    const originalPlanMigration = MigrationPlanner.planMigration;
    MigrationPlanner.planMigration = (def, pat) => {
      const res = originalPlanMigration(def, pat);
      return {
        ...res,
        rollbackPlan: {
          strategy: "MIGRATION_DOWN",
          steps: [],
          dataLossRisk: "HIGH",
          safeRollbackGuaranteed: false
        }
      };
    };

    try {
      expect(() => {
        VerticalSlicePlanner.plan(sampleManifest, sampleGraph, sampleGapReport, "webhooks");
      }).toThrow(/NO ROLLBACK PLAN -> NO MIGRATION/);
    } finally {
      MigrationPlanner.planMigration = originalPlanMigration;
    }
  });

  it("enforces NO POLICY -> NO TENANT-SCOPED ENDPOINT", () => {
    const originalPlanPolicies = PolicyPlanner.planPolicies;
    PolicyPlanner.planPolicies = () => [];

    try {
      expect(() => {
        VerticalSlicePlanner.plan(sampleManifest, sampleGraph, sampleGapReport, "webhooks");
      }).toThrow(/NO POLICY -> NO TENANT-SCOPED ENDPOINT/);
    } finally {
      PolicyPlanner.planPolicies = originalPlanPolicies;
    }
  });
});
