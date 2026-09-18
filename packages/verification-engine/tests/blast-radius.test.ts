import { describe, it, expect } from "vitest";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import { BlastRadiusAnalyzer } from "../src/reports/blast-radius.js";

describe("BlastRadiusAnalyzer", () => {
  const graph: ArchitectureGraphData = {
    graphVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes: [
      { id: "model:Organization", type: "MODEL", name: "Organization", file: "app/models/organization.rb" },
      { id: "spec:OrganizationSpec", type: "TEST_SPEC", name: "OrganizationSpec", file: "spec/models/organization_spec.rb" },
      { id: "controller:Api::V1::MissionsController", type: "CONTROLLER", name: "Api::V1::MissionsController", file: "app/controllers/api/v1/missions_controller.rb" }
    ],
    edges: [
      {
        edgeId: "edge-1",
        source: "spec:OrganizationSpec",
        target: "model:Organization",
        type: "TESTS",
        confidence: "HIGH",
        evidence: { file: "spec/models/organization_spec.rb", reason: "spec" }
      },
      {
        edgeId: "edge-2",
        source: "controller:Api::V1::MissionsController",
        target: "model:Organization",
        type: "READS",
        confidence: "HIGH",
        evidence: { file: "app/controllers/api/v1/missions_controller.rb", reason: "uses organization" }
      }
    ]
  };

  const slicePlan: VerticalSlicePlan = {
    capability: "webhooks",
    title: "Outgoing Webhooks",
    description: "",
    requirements: [],
    currentEvidence: [],
    gaps: [],
    affectedComponents: [],
    existingPatterns: {
      jobs: { baseClass: "ApplicationJob", queueName: "webhooks", retryPolicy: "", errorHandling: "", loggingPattern: "" },
      services: { patternType: "CALL_METHOD", namespaceConvention: "", methodSignature: "" },
      controllers: { apiBaseClass: "Api::V1::BaseController", authMethod: "", errorHandling: "", paramsConvention: "", responseSerializer: "" },
      policies: { framework: "PUNDIT", baseClass: "ApplicationPolicy", tenancyScopePattern: "" },
      models: { tenancyAssociation: "belongs_to :organization", tenantKey: "organization_id", idType: "uuid", encryptionHelper: "ActiveRecord::Encryption", timestamps: true },
      migrations: { railsVersion: "8.0", uuidPrimaryKey: true, foreignKeyConstraints: true, indexesConvention: true },
      tests: { framework: "rspec", specTypes: { model: true, request: true, policy: true, job: true, service: true }, authHeaderHelper: "", factoryPattern: "factory_bot" },
      admin: { framework: "none", resourcePath: "" },
      frontend: { framework: "none", apiClient: "", authStorage: "" }
    },
    databaseChanges: [],
    models: [],
    policies: [],
    services: [],
    jobs: [{ name: "Webhooks::DeliverPayloadJob", className: "Webhooks::DeliverPayloadJob", filePath: "app/jobs/deliver.rb", queue: "webhooks", retryPolicy: "", timeoutSeconds: 10, parameters: {}, codePreview: "" }],
    controllers: [{ name: "Api::V1::Developer::WebhooksController", className: "Api::V1::Developer::WebhooksController", filePath: "app/controllers/webhooks.rb", baseClass: "", actions: [], codePreview: "" }],
    routes: [],
    apiContracts: [],
    activeAdmin: [],
    frontendChanges: [],
    tests: [],
    securityChecks: [],
    migrationPlan: { migrationName: "", versionTag: "", filename: "", targetPath: "", rubyCode: "", changes: [], reversible: true },
    rollbackPlan: { strategy: "MIGRATION_DOWN", steps: [], dataLossRisk: "LOW", safeRollbackGuaranteed: true },
    verificationPlan: { preConditions: [], checks: [], postConditions: [] },
    risks: [],
    assumptions: [],
    unresolvedQuestions: []
  };

  it("calculates direct, critical, and protecting tests for blast radius", () => {
    const blastRadius = BlastRadiusAnalyzer.analyze(graph, slicePlan);
    expect(blastRadius.direct).toContain("Model: Organization (receives association)");
    expect(blastRadius.direct).toContain("Controller: Api::V1::Developer::WebhooksController");
    expect(blastRadius.critical).toContain("Model: Organization (Core Tenancy Boundary)");
    expect(blastRadius.testsProtecting).toContain("OrganizationSpec (spec/models/organization_spec.rb)");
    expect(blastRadius.impactedComponentsCount).toBeGreaterThan(0);
  });
});
