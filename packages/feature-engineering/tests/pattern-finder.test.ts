import { describe, it, expect } from "vitest";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import { PatternFinder } from "../src/pattern-finder.js";

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
      frontend: "nextjs",
      database: "postgres",
      postgis: false,
      queue: "sidekiq",
      storage: "active_storage"
    },
    versions: {
      rails: "8.0.5",
      ruby: "3.3.0"
    },
    backend: {
      framework: "rails",
      routes: [],
      models: [
        { name: "Organization", tableName: "organizations", file: "app/models/organization.rb", associations: [], attributes: [], isTenantScoped: false },
        { name: "User", tableName: "users", file: "app/models/user.rb", associations: [], attributes: [], isTenantScoped: true },
        { name: "Mission", tableName: "missions", file: "app/models/mission.rb", associations: [], attributes: [], isTenantScoped: true }
      ],
      controllers: [
        { name: "Api::V1::BaseController", file: "app/controllers/api/v1/base_controller.rb", actions: [], tenantScoped: true },
        { name: "Api::V1::MissionsController", file: "app/controllers/api/v1/missions_controller.rb", actions: ["index"], tenantScoped: true }
      ],
      policies: [
        { name: "ApplicationPolicy", file: "app/policies/application_policy.rb", model: "Application", actions: [] },
        { name: "MissionPolicy", file: "app/policies/mission_policy.rb", model: "Mission", actions: ["index?", "show?"] }
      ],
      services: [
        { name: "ApplicationService", file: "app/services/application_service.rb", methods: ["call"] }
      ],
      jobs: [
        { name: "ApplicationJob", file: "app/jobs/application_job.rb", queue: "default" },
        { name: "Missions::ProcessJob", file: "app/jobs/missions/process_job.rb", queue: "default" }
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
      routes: [{ path: "app/dashboard/page.tsx", file: "app/dashboard/page.tsx", type: "page" }],
      components: [],
      hooks: [],
      uiLibrary: "tailwind",
      styling: []
    },
    database: {
      type: "postgres",
      postgis: false,
      tables: [
        {
          name: "organizations",
          columns: [{ name: "id", type: "uuid" }],
          indexes: []
        }
      ],
      migrations: []
    },
    background_jobs: {
      runner: "sidekiq",
      queues: ["default"],
      jobs: ["ApplicationJob"]
    },
    storage: {
      provider: "active_storage",
      activeStorage: true,
      s3Compatible: false
    },
    auth: {
      mechanisms: ["api_key"],
      mfa: false,
      oauth: [],
      apiKeys: true
    },
    admin: {
      type: "active_admin",
      resources: ["Mission"]
    },
    tests: {
      frameworks: ["rspec"],
      specCount: 2,
      testPaths: ["spec/models/mission_spec.rb", "spec/requests/api/v1/missions_spec.rb"],
      specs: [
        {
          file: "spec/models/mission_spec.rb",
          type: "model",
          targetComponent: "Mission",
          evidence: {
            file: "spec/models/mission_spec.rb",
            evidence_type: "TEST",
            confidence: "HIGH",
            description: "Mission model spec"
          }
        },
        {
          file: "spec/requests/api/v1/missions_spec.rb",
          type: "request",
          targetComponent: "Api::V1::MissionsController",
          evidence: {
            file: "spec/requests/api/v1/missions_spec.rb",
            evidence_type: "TEST",
            confidence: "HIGH",
            description: "Missions request spec"
          }
        }
      ]
    },
    infra: {
      docker: true,
      compose: true,
      githubActions: true,
      workflows: []
    },
    security: {
      secretFindings: [],
      unsafeFilesBlocked: []
    },
    unknowns: []
  };
}

describe("PatternFinder", () => {
  it("identifies Job patterns correctly", () => {
    const manifest = createMockManifest();
    const pattern = PatternFinder.findJobPattern(manifest);
    expect(pattern.baseClass).toBe("ApplicationJob");
    expect(pattern.retryPolicy).toContain("retry_on");
  });

  it("identifies Controller and auth patterns correctly", () => {
    const manifest = createMockManifest();
    const pattern = PatternFinder.findControllerPattern(manifest);
    expect(pattern.apiBaseClass).toBe("Api::V1::BaseController");
    expect(pattern.authMethod).toBe("authenticate_api_key!");
  });

  it("identifies Policy and Tenant scope patterns correctly", () => {
    const manifest = createMockManifest();
    const pattern = PatternFinder.findPolicyPattern(manifest);
    expect(pattern.framework).toBe("PUNDIT");
    expect(pattern.baseClass).toBe("ApplicationPolicy");
    expect(pattern.tenancyScopePattern).toContain("scope.where(organization");
  });

  it("identifies Model tenancy and UUID primary key patterns correctly", () => {
    const manifest = createMockManifest();
    const pattern = PatternFinder.findModelPattern(manifest);
    expect(pattern.tenancyAssociation).toBe("belongs_to :organization");
    expect(pattern.idType).toBe("uuid");
    expect(pattern.encryptionHelper).toBe("ActiveRecord::Encryption");
  });

  it("identifies ActiveAdmin and RSpec patterns correctly", () => {
    const manifest = createMockManifest();
    const admin = PatternFinder.findAdminPattern(manifest);
    expect(admin.framework).toBe("active_admin");

    const tests = PatternFinder.findTestPattern(manifest);
    expect(tests.framework).toBe("rspec");
    expect(tests.specTypes.model).toBe(true);
    expect(tests.specTypes.request).toBe(true);
  });
});
