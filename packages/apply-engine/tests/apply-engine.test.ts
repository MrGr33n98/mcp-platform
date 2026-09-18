import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { VerificationEngine } from "@mcp-platform/verification-engine";
import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import { ApplyEngine } from "../src/apply-engine.js";
import { ReceiptChainValidator } from "../src/preflight/receipt-validator.js";
import type { ApprovalReceipt } from "../src/types.js";

describe("ApplyEngine End-to-End Canary & Safety Gate (Phase 5G)", () => {
  let tempWorkspace: string;

  beforeEach(() => {
    tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-canary-apply-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  });

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
      {
        id: "OP-001-MIGRATION",
        type: "RUN_MIGRATION",
        path: "db/migrate/20260917000000_create_webhooks.rb",
        description: "Migration",
        patternApplied: "Rails Migration [8.0]",
        codePreview: "# frozen_string_literal: true\nclass CreateWebhooks < ActiveRecord::Migration[8.0]\nend\n"
      },
      {
        id: "OP-002-MODEL",
        type: "CREATE_FILE",
        path: "app/models/webhook_endpoint.rb",
        description: "Model WebhookEndpoint",
        patternApplied: "ApplicationRecord with belongs_to :organization",
        codePreview: "# frozen_string_literal: true\nclass WebhookEndpoint < ApplicationRecord\n  belongs_to :organization\nend\n"
      },
      {
        id: "OP-003-POLICY",
        type: "CREATE_FILE",
        path: "app/policies/webhook_endpoint_policy.rb",
        description: "Policy",
        patternApplied: "ApplicationPolicy with Scope isolation",
        codePreview: "# frozen_string_literal: true\nclass WebhookEndpointPolicy < ApplicationPolicy\n  class Scope < ApplicationPolicy::Scope\n    def resolve; scope.where(organization: user.organization); end\n  end\nend\n"
      },
      {
        id: "OP-004-CONTROLLER",
        type: "CREATE_FILE",
        path: "app/controllers/api/v1/developer/webhooks_controller.rb",
        description: "Controller",
        patternApplied: "Api::V1::BaseController",
        codePreview: "# frozen_string_literal: true\nclass Api::V1::Developer::WebhooksController < Api::V1::BaseController\n  before_action :authenticate_api_key!\n  def index; policy_scope(WebhookEndpoint); end\nend\n"
      },
      {
        id: "OP-005-TEST",
        type: "CREATE_FILE",
        path: "spec/models/webhook_endpoint_spec.rb",
        description: "Model Spec",
        patternApplied: "RSpec",
        codePreview: "# frozen_string_literal: true\nRSpec.describe WebhookEndpoint do\nend\n"
      }
    ],
    verification: [],
    rollback: [],
    approval_required: true
  };

  const sampleSlicePlan: VerticalSlicePlan = {
    capability: "webhooks",
    title: "Outgoing Webhooks",
    description: "Full vertical slice",
    requirements: [
      { requirementId: "WHK-001", title: "Domain Model", severity: "P2_NORMAL", status: "MISSING", evidence: [], confidence: "HIGH", explanation: "Missing" }
    ],
    currentEvidence: [],
    gaps: ["No webhook models"],
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

  it("applies verified change plan to isolated canary fixture producing APPLIED_VERIFIED status and ApplyReceipt", async () => {
    // 1. Run Verification to obtain real VerificationReceipt
    const verifResult = await VerificationEngine.verify({
      workspace: { rootPath: tempWorkspace },
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

    expect(verifResult.receipt.verification_status).toBe("PASS");

    // 2. Generate Authenticated ApprovalReceipt
    const approvalData: Omit<ApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "APPR-CANARY-001",
      approver_id: "lead_architect",
      approver_type: "HUMAN_OPERATOR",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      change_plan_digest: verifResult.receipt.change_plan_digest,
      verification_digest: verifResult.receipt.verification_digest,
      repository_revision: verifResult.receipt.repository_revision,
      workspace_id: "canary_workspace",
      scope: { entire_change_plan: true },
      nonce: "nonce_secure_canary_1234"
    };

    const signature = ReceiptChainValidator.computeApprovalSignature(approvalData);
    const approvalReceipt: ApprovalReceipt = {
      ...approvalData,
      signature_or_mac: signature
    };

    // 3. Apply via ApplyEngine
    const applyResult = await ApplyEngine.apply({
      workspaceRoot: tempWorkspace,
      changePlan: sampleChangePlan,
      verticalSlicePlan: sampleSlicePlan,
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      verificationReceipt: verifResult.receipt,
      approvalReceipt,
      options: {
        allowDirtyTreeForTest: true,
        customCurrentRevision: verifResult.receipt.repository_revision
      }
    });

    // 4. Assertions on Result
    expect(applyResult.report.status).toBe("APPLIED_VERIFIED");
    expect(applyResult.receipt).toBeDefined();
    expect(applyResult.receipt?.receipt_type).toBe("APPLY_RECEIPT");
    expect(applyResult.receipt?.status).toBe("APPLIED_VERIFIED");
    expect(applyResult.report.actual_change_surface.files_created.length).toBe(5);

    // 5. Verify files exist on disk in tempWorkspace
    const migrationFile = path.join(tempWorkspace, "db/migrate/20260917000000_create_webhooks.rb");
    const modelFile = path.join(tempWorkspace, "app/models/webhook_endpoint.rb");
    const policyFile = path.join(tempWorkspace, "app/policies/webhook_endpoint_policy.rb");
    const controllerFile = path.join(tempWorkspace, "app/controllers/api/v1/developer/webhooks_controller.rb");
    const specFile = path.join(tempWorkspace, "spec/models/webhook_endpoint_spec.rb");

    expect(fs.existsSync(migrationFile)).toBe(true);
    expect(fs.existsSync(modelFile)).toBe(true);
    expect(fs.existsSync(policyFile)).toBe(true);
    expect(fs.existsSync(controllerFile)).toBe(true);
    expect(fs.existsSync(specFile)).toBe(true);

    expect(applyResult.markdown).toContain("# RELATÓRIO DE APLICAÇÃO CONTROLADA");
    expect(applyResult.markdown).toContain("APPLIED_VERIFIED");
  });

  it("performs safe dry-run without writing any files to disk", async () => {
    const verifResult = await VerificationEngine.verify({
      workspace: { rootPath: tempWorkspace },
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

    const approvalData: Omit<ApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "APPR-DRYRUN-001",
      approver_id: "lead_architect",
      approver_type: "HUMAN_OPERATOR",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      change_plan_digest: verifResult.receipt.change_plan_digest,
      verification_digest: verifResult.receipt.verification_digest,
      repository_revision: verifResult.receipt.repository_revision,
      workspace_id: "dryrun_workspace",
      scope: { entire_change_plan: true },
      nonce: "nonce_dryrun_9999"
    };

    const approvalReceipt: ApprovalReceipt = {
      ...approvalData,
      signature_or_mac: ReceiptChainValidator.computeApprovalSignature(approvalData)
    };

    const dryRunResult = await ApplyEngine.apply({
      workspaceRoot: tempWorkspace,
      changePlan: sampleChangePlan,
      verticalSlicePlan: sampleSlicePlan,
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      verificationReceipt: verifResult.receipt,
      approvalReceipt,
      options: {
        dryRun: true,
        allowDirtyTreeForTest: true,
        customCurrentRevision: verifResult.receipt.repository_revision
      }
    });

    expect(dryRunResult.report.status).toBe("APPLIED");
    expect(dryRunResult.report.mutations_applied).toBe(0);
    expect(fs.existsSync(path.join(tempWorkspace, "app/models/webhook_endpoint.rb"))).toBe(false);
  });

  it("automatically rolls back when post-apply verification detects an architectural violation", async () => {
    // Inject a violation in the slice plan (e.g. invalid base class)
    const failingSlicePlan: VerticalSlicePlan = {
      ...sampleSlicePlan,
      jobs: [
        {
          name: "InvalidJob",
          className: "InvalidJob",
          filePath: "app/jobs/invalid_job.rb",
          queue: "default",
          retryPolicy: "none",
          timeoutSeconds: 5,
          parameters: {},
          codePreview: "class InvalidJob\n  # Missing ApplicationJob inheritance\nend"
        }
      ]
    };

    const failingChangePlan: ChangePlan = {
      ...sampleChangePlan,
      operations: [
        {
          id: "OP-FAIL-JOB",
          type: "CREATE_FILE",
          path: "app/jobs/invalid_job.rb",
          description: "Invalid Job",
          patternApplied: "None",
          codePreview: "class InvalidJob\nend\n"
        }
      ]
    };

    const verifResult = await VerificationEngine.verify({
      workspace: { rootPath: tempWorkspace },
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      changePlan: failingChangePlan,
      verticalSlicePlan: sampleSlicePlan, // verify with valid slice to get PASS on plan
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

    const approvalData: Omit<ApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "APPR-FAIL-001",
      approver_id: "lead_architect",
      approver_type: "HUMAN_OPERATOR",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      change_plan_digest: verifResult.receipt.change_plan_digest,
      verification_digest: verifResult.receipt.verification_digest,
      repository_revision: verifResult.receipt.repository_revision,
      workspace_id: "failing_workspace",
      scope: { entire_change_plan: true },
      nonce: "nonce_fail_5555"
    };

    const approvalReceipt: ApprovalReceipt = {
      ...approvalData,
      signature_or_mac: ReceiptChainValidator.computeApprovalSignature(approvalData)
    };

    const result = await ApplyEngine.apply({
      workspaceRoot: tempWorkspace,
      changePlan: failingChangePlan,
      verticalSlicePlan: failingSlicePlan, // pass failing slice plan at post-apply time
      repositoryManifest: sampleManifest,
      architectureGraph: sampleGraph,
      verificationReceipt: verifResult.receipt,
      approvalReceipt,
      options: {
        allowDirtyTreeForTest: true,
        customCurrentRevision: verifResult.receipt.repository_revision
      }
    });

    expect(result.report.status).toBe("FAILED_ROLLED_BACK");
    expect(result.report.rollback_report).toBeDefined();
    expect(result.report.rollback_report?.status).toBe("SUCCESS");
    // Verify file was cleaned up by rollback
    expect(fs.existsSync(path.join(tempWorkspace, "app/jobs/invalid_job.rb"))).toBe(false);
  });
});
