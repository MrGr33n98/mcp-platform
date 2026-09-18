import { describe, it, expect } from "vitest";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import { VerificationEngine } from "../src/verification-engine.js";

describe("VerificationEngine (Phase 5F)", () => {
  const sampleManifest: RepositoryManifest = {
    manifestVersion: 1,
    scannedAt: new Date().toISOString(),
    validation: { status: "VALID", workspace_type: "SINGLE_APP", repository_root: "/fake/repo", backend_roots: ["/fake/repo"], frontend_roots: [], nested_apps: [], evidence: [] },
    scanCoverage: { files_discovered: 5, files_scanned: 5, files_skipped: 0, parse_failures: 0, unsupported_files: 0, coverage_confidence: "HIGH", limitations: [] },
    repository: { path: "/fake/repo", name: "oest" },
    stack: { backend: "rails", frontend: "none", database: "postgres", postgis: false, queue: "sidekiq", storage: "active_storage" },
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
    frontend: { framework: "none", appRouter: false, pagesRouter: false, routes: [], components: [], hooks: [], uiLibrary: "none", styling: [] },
    database: { type: "postgres", postgis: false, tables: [{ name: "organizations", columns: [{ name: "id", type: "uuid" }], indexes: [] }], migrations: [] },
    background_jobs: { runner: "sidekiq", queues: ["default"], jobs: [] },
    storage: { provider: "local", activeStorage: true, s3Compatible: false },
    auth: { mechanisms: ["api_key"], mfa: false, oauth: [], apiKeys: true },
    admin: { type: "none", resources: [] },
    tests: { frameworks: ["rspec"], specCount: 1, testPaths: ["spec/models/organization_spec.rb"], specs: [] },
    infra: { docker: false, compose: false, githubActions: false, workflows: [] },
    security: { secretFindings: [], unsafeFilesBlocked: [] },
    unknowns: []
  };

  const sampleGraph: ArchitectureGraphData = {
    graphVersion: 1,
    generatedAt: new Date().toISOString(),
    nodes: [{ id: "model:Organization", type: "MODEL", name: "Organization", file: "app/models/organization.rb" }],
    edges: []
  };

  const sampleChangePlan: ChangePlan = {
    schema_version: 1,
    mode: "PLAN_ONLY",
    product: "oest",
    capability: "webhooks",
    operations: [
      { id: "OP-001", type: "RUN_MIGRATION", path: "db/migrate/20260917000000_create_webhooks.rb", description: "Create tables (webhook_endpoints)", patternApplied: "Rails Migration [8.0]" },
      { id: "OP-002", type: "CREATE_FILE", path: "app/models/webhook_endpoint.rb", description: "Model WebhookEndpoint", patternApplied: "ApplicationRecord" },
      { id: "OP-003", type: "CREATE_FILE", path: "app/policies/webhook_endpoint_policy.rb", description: "Policy", patternApplied: "Pundit" },
      { id: "OP-004", type: "CREATE_FILE", path: "app/controllers/api/v1/developer/webhooks_controller.rb", description: "Controller", patternApplied: "Api::V1::BaseController" },
      { id: "OP-005", type: "CREATE_FILE", path: "spec/models/webhook_endpoint_spec.rb", description: "Spec", patternApplied: "RSpec" }
    ],
    verification: [],
    rollback: [],
    approval_required: true
  };

  const sampleSlicePlan: VerticalSlicePlan = {
    capability: "webhooks",
    title: "Outgoing Webhooks",
    description: "Full plan",
    requirements: [
      { requirementId: "WHK-001", title: "Domain Model", severity: "P2_NORMAL", status: "MISSING", evidence: [], confidence: "HIGH", explanation: "Missing" }
    ],
    currentEvidence: [],
    gaps: ["No models"],
    affectedComponents: [],
    existingPatterns: {
      jobs: { baseClass: "ApplicationJob", queueName: "webhooks", retryPolicy: "retry_on", errorHandling: "rescue", loggingPattern: "logger" },
      services: { patternType: "CALL_METHOD", namespaceConvention: "Webhooks", methodSignature: "def self.call" },
      controllers: { apiBaseClass: "Api::V1::BaseController", authMethod: "authenticate_api_key!", errorHandling: "rescue", paramsConvention: "params", responseSerializer: "render" },
      policies: { framework: "PUNDIT", baseClass: "ApplicationPolicy", tenancyScopePattern: "scope.where(organization: user.organization)" },
      models: { tenancyAssociation: "belongs_to :organization", tenantKey: "organization_id", idType: "uuid", encryptionHelper: "ActiveRecord::Encryption", timestamps: true },
      migrations: { railsVersion: "8.0", uuidPrimaryKey: true, foreignKeyConstraints: true, indexesConvention: true },
      tests: { framework: "rspec", specTypes: { model: true, request: true, policy: true, job: true, service: true }, authHeaderHelper: "headers", factoryPattern: "factory_bot" },
      admin: { framework: "none", resourcePath: "" },
      frontend: { framework: "none", apiClient: "", authStorage: "" }
    },
    databaseChanges: [
      {
        table: "webhook_endpoints",
        operation: "CREATE_TABLE",
        columns: [{ name: "id", type: "uuid" }, { name: "organization_id", type: "uuid" }],
        foreignKeys: [{ column: "organization_id", toTable: "organizations" }],
        indexes: [{ columns: ["organization_id"] }]
      }
    ],
    models: [
      {
        name: "WebhookEndpoint",
        className: "WebhookEndpoint",
        filePath: "app/models/webhook_endpoint.rb",
        tableName: "webhook_endpoints",
        belongsToTenancy: "belongs_to :organization",
        associations: ["belongs_to :organization"],
        validations: ["validates :url, presence: true"],
        scopes: [],
        encryptedAttributes: ["encrypted_secret"],
        codePreview: "class WebhookEndpoint < ApplicationRecord\n  belongs_to :organization\n  encrypts :encrypted_secret\nend"
      }
    ],
    policies: [
      {
        name: "WebhookEndpointPolicy",
        className: "WebhookEndpointPolicy",
        filePath: "app/policies/webhook_endpoint_policy.rb",
        modelName: "WebhookEndpoint",
        actions: [],
        scopeDefinition: "class Scope < ApplicationPolicy::Scope\n  def resolve; scope.where(organization: user.organization); end\nend",
        codePreview: "class WebhookEndpointPolicy < ApplicationPolicy\n  def index?; user.present?; end\n  class Scope < ApplicationPolicy::Scope\n    def resolve; scope.where(organization: user.organization); end\n  end\nend"
      }
    ],
    services: [
      {
        name: "Webhooks::SsrfValidatorService",
        className: "Webhooks::SsrfValidatorService",
        filePath: "app/services/webhooks/ssrf_validator_service.rb",
        responsibility: "SSRF",
        inputs: {},
        outputs: {},
        errorHandling: "rescue",
        codePreview: "class Webhooks::SsrfValidatorService\n  DISALLOWED_RANGES = [IPAddr.new('127.0.0.0/8'), IPAddr.new('10.0.0.0/8'), IPAddr.new('192.168.0.0/16'), IPAddr.new('169.254.0.0/16'), IPAddr.new('::1/128')]\nend"
      },
      {
        name: "Webhooks::HmacSignerService",
        className: "Webhooks::HmacSignerService",
        filePath: "app/services/webhooks/hmac_signer_service.rb",
        responsibility: "HMAC",
        inputs: {},
        outputs: {},
        errorHandling: "rescue",
        codePreview: "class Webhooks::HmacSignerService\n  def self.sign(secret:, timestamp:, raw_payload:)\n    OpenSSL::HMAC.hexdigest('SHA256', secret, \"#{timestamp}.#{raw_payload}\")\n  end\nend"
      }
    ],
    jobs: [
      {
        name: "Webhooks::DeliverPayloadJob",
        className: "Webhooks::DeliverPayloadJob",
        filePath: "app/jobs/webhooks/deliver_payload_job.rb",
        queue: "webhooks",
        retryPolicy: "retry_on",
        timeoutSeconds: 10,
        parameters: {},
        codePreview: "class Webhooks::DeliverPayloadJob < ApplicationJob\n  def perform; http.open_timeout = 10; end\nend"
      }
    ],
    controllers: [
      {
        name: "Api::V1::Developer::WebhooksController",
        className: "Api::V1::Developer::WebhooksController",
        filePath: "app/controllers/api/v1/developer/webhooks_controller.rb",
        baseClass: "Api::V1::BaseController",
        actions: [
          { name: "index", description: "List endpoints", httpMethod: "GET", path: "/api/v1/developer/webhooks", params: [], responseType: "json", policyCheck: "policy_scope" }
        ],
        codePreview: "class Api::V1::Developer::WebhooksController < Api::V1::BaseController\n  before_action :authenticate_api_key!\n  def index; policy_scope(WebhookEndpoint); end\nend"
      }
    ],
    routes: [
      { method: "GET", path: "/api/v1/developer/webhooks", controller: "api/v1/developer/webhooks", action: "index", description: "List" }
    ],
    apiContracts: [
      { endpoint: "/api/v1/developer/webhooks", method: "GET", requestSchema: {}, responseSchema: { webhooks: "array" }, statusCodes: [200, 401] }
    ],
    activeAdmin: [],
    frontendChanges: [],
    tests: [
      { category: "MODEL_SPEC", filePath: "spec/models/webhook_endpoint_spec.rb", description: "Model spec", testCases: [], codePreview: "" },
      { category: "CROSS_TENANT_SPEC", filePath: "spec/requests/webhooks_cross_tenant_spec.rb", description: "Cross tenant spec", testCases: [], codePreview: "" }
    ],
    securityChecks: [],
    migrationPlan: {
      migrationName: "CreateWebhooks",
      versionTag: "20260917000000",
      filename: "20260917000000_create_webhooks.rb",
      targetPath: "db/migrate/20260917000000_create_webhooks.rb",
      rubyCode: "class CreateWebhooks < ActiveRecord::Migration[8.0]\n  def change\n  end\nend",
      changes: [
        {
          table: "webhook_endpoints",
          operation: "CREATE_TABLE",
          columns: [{ name: "id", type: "uuid" }, { name: "organization_id", type: "uuid" }],
          foreignKeys: [{ column: "organization_id", toTable: "organizations" }],
          indexes: [{ columns: ["organization_id"] }]
        }
      ],
      reversible: true
    },
    rollbackPlan: {
      strategy: "MIGRATION_DOWN",
      steps: [{ stepNumber: 1, name: "Rollback", description: "Rollback", command: "rails db:rollback", riskLevel: "LOW" }],
      dataLossRisk: "LOW",
      safeRollbackGuaranteed: true
    },
    verificationPlan: { preConditions: [], checks: [], postConditions: [] },
    risks: [],
    assumptions: [],
    unresolvedQuestions: []
  };

  it("verifies a valid feature plan and generates a VerificationReceipt with PASS", async () => {
    const result = await VerificationEngine.verify({
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      changePlan: sampleChangePlan,
      verticalSlicePlan: sampleSlicePlan,
      options: {
        mode: "STATIC_VERIFY",
        customRevision: {
          commitSha: "abc1234567890abcdef1234567890abcdef12",
          branch: "main",
          dirty: false,
          capturedAt: new Date().toISOString()
        }
      }
    });

    // 1. Report Checks
    expect(result.report.schema_version).toBe(1);
    expect(result.report.status).toBe("PASS");
    expect(result.report.target.product).toBe("oest");
    expect(result.report.target.capability).toBe("webhooks");
    expect(result.report.change_plan_digest).toBeDefined();
    expect(result.report.change_plan_digest.length).toBe(64);
    expect(result.report.failures.length).toBe(0);
    expect(result.report.warnings.length).toBe(0);
    expect(result.report.checks.length).toBeGreaterThan(10);

    // 2. Receipt Checks
    expect(result.receipt.receipt_type).toBe("VERIFICATION_RECEIPT");
    expect(result.receipt.verification_status).toBe("PASS");
    expect(result.receipt.verification_digest.length).toBe(64);

    // 3. Markdown Output Checks
    expect(result.markdown).toContain("# RELATÓRIO DE VERIFICAÇÃO ARQUITETURAL");
    expect(result.markdown).toContain("PASS (APROVADO PARA REVISÃO HUMANA)");
    expect(result.markdown).toContain("VERIFICATION_RECEIPT");
  });

  it("yields CONDITIONAL_PASS when optional contract schemas are absent", async () => {
    const partialSlicePlan = {
      ...sampleSlicePlan,
      apiContracts: []
    };

    const result = await VerificationEngine.verify({
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      changePlan: sampleChangePlan,
      verticalSlicePlan: partialSlicePlan,
      options: {
        mode: "STATIC_VERIFY",
        customRevision: {
          commitSha: "abc1234567890abcdef1234567890abcdef12",
          branch: "main",
          dirty: false,
          capturedAt: new Date().toISOString()
        }
      }
    });

    expect(result.report.status).toBe("CONDITIONAL_PASS");
    expect(result.receipt.verification_status).toBe("CONDITIONAL_PASS");
    expect(result.report.warnings.length).toBeGreaterThan(0);
  });
});
