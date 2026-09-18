import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { ToolRegistry, createToolExecutionContext } from "@mcp-platform/core";
import { registerEngineeringTools } from "../src/tools/register-all.js";
import { ReplayProtectionTracker } from "../src/security/replay-protection.js";
import { VerificationReportBuilder, type RepositoryRevision } from "@mcp-platform/verification-engine";
import { ReceiptChainValidator, type ApprovalReceipt } from "@mcp-platform/apply-engine";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";

describe("Engineering MCP Dry-Run Safety", () => {
  const registry = new ToolRegistry();
  registerEngineeringTools(registry);
  const context = createToolExecutionContext({ productId: "engineering" });

  let tempDir: string;

  beforeEach(async () => {
    ReplayProtectionTracker.reset();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "mcp-dryrun-test-"));
    // Create basic structure for scanner
    await fs.mkdir(path.join(tempDir, "config"), { recursive: true });
    await fs.writeFile(path.join(tempDir, "config", "routes.rb"), "Rails.application.routes.draw do\nend\n");
    await fs.writeFile(path.join(tempDir, "Gemfile"), 'source "https://rubygems.org"\ngem "rails"\n');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("preview_apply performs dry run with 0 mutations applied", async () => {
    const plannedOp = {
      id: "op_1",
      type: "CREATE_FILE" as const,
      path: "app/models/new_model.rb",
      description: "Add model",
      patternApplied: "ActiveRecord Model Pattern",
      codePreview: "class NewModel < ApplicationRecord\nend\n",
    };

    const changePlan: ChangePlan = {
      schema_version: 1,
      mode: "PLAN_ONLY",
      product: "test",
      capability: "tenancy",
      operations: [plannedOp],
      verification: [],
      rollback: [],
      approval_required: true,
    };

    const planDigest = VerificationReportBuilder.calculatePlanDigest(changePlan);

    const verticalSlicePlan: VerticalSlicePlan = {
      capability: "tenancy",
      title: "Add Tenancy Model",
      description: "Tenancy model addition",
      requirements: [],
      currentEvidence: [],
      gaps: [],
      affectedComponents: [],
      models: [
        {
          name: "NewModel",
          className: "NewModel",
          filePath: "app/models/new_model.rb",
          tableName: "new_models",
          belongsTo: [],
          hasMany: [],
          attributes: [],
          isTenantScoped: true,
          tenantKey: "organization_id",
          encryptionFields: [],
          codePreview: "class NewModel < ApplicationRecord\nend\n",
        },
      ],
      policies: [],
      controllers: [],
      services: [],
      jobs: [],
      mailers: [],
      adminResources: [],
      routes: [],
      apiContracts: [],
      frontendChanges: [],
      tests: [],
      securityChecks: [],
      databaseChanges: [],
      migrationPlan: {
        migrationVersion: "20230101000000",
        migrationName: "create_new_models",
        filePath: "db/migrate/20230101000000_create_new_models.rb",
        reversible: true,
        operations: [],
        codePreview: "",
      },
      rollbackPlan: {
        strategy: "REVERT_MIGRATION",
        steps: [],
        automatedRollbackPossible: true,
      },
      verificationPlan: {
        preConditions: [],
        checks: [],
        postConditions: [],
      },
      risks: [],
      assumptions: [],
      unresolvedQuestions: [],
      existingPatterns: {
        models: {
          tenancyAssociation: "belongs_to :organization",
          tenantKey: "organization_id",
          idType: "bigint",
          encryptionHelper: "none",
          timestamps: true,
        },
        controllers: {
          apiBaseClass: "ApplicationController",
          authMethod: "authenticate_user!",
          errorHandling: "rescue_from",
          paramsConvention: "strong_params",
          responseSerializer: "json",
        },
        policies: {
          framework: "PUNDIT",
          baseClass: "ApplicationPolicy",
          tenancyScopePattern: "Scope",
        },
        services: {
          patternType: "APPLICATION_SERVICE",
          namespaceConvention: "Services",
          methodSignature: "call",
        },
        jobs: {
          baseClass: "ApplicationJob",
          queueName: "default",
          retryPolicy: "default",
          errorHandling: "default",
          loggingPattern: "default",
        },
        migrations: {
          railsVersion: "7.0",
          uuidPrimaryKey: false,
          foreignKeyConstraints: true,
          indexesConvention: true,
        },
        tests: {
          framework: "rspec",
          specTypes: { model: true, request: true, policy: true, job: true, service: true },
          authHeaderHelper: "auth_headers",
          factoryPattern: "factory_bot",
        },
      },
    };

    const repoRevision: RepositoryRevision = {
      commitSha: "test_sha_12345678",
      branch: "main",
      dirty: false,
      capturedAt: new Date().toISOString(),
    };

    const verificationReceipt = {
      schema_version: 1,
      receipt_type: "VERIFICATION_RECEIPT" as const,
      verification_id: "verif_1",
      target_product: "test",
      target_capability: "tenancy",
      change_plan_digest: planDigest,
      repository_revision: repoRevision,
      mode: "STATIC_VERIFY",
      verification_status: "PASS" as const,
      overall_status: "VERIFIED" as const,
      verification_digest: "sha256:vdigest1234567890abcdef",
      timestamp: new Date().toISOString(),
    };

    const rawApproval: Omit<ApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "appr_dry_1",
      approver_id: "test_admin",
      approver_type: "DEV_LOCAL",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
      change_plan_digest: planDigest,
      verification_digest: "sha256:vdigest1234567890abcdef",
      repository_revision: repoRevision,
      workspace_id: "ws_dry",
      scope: { entire_change_plan: true },
      nonce: "nonce_dry_12345678",
    };

    const sig = ReceiptChainValidator.computeApprovalSignature(rawApproval);

    const approvalReceipt: ApprovalReceipt = {
      ...rawApproval,
      signature_or_mac: sig,
    };

    const result = await registry.execute(
      "engineering_preview_apply",
      {
        repository_path: tempDir,
        change_plan: changePlan as any,
        vertical_slice_plan: verticalSlicePlan as any,
        verification_receipt: verificationReceipt as any,
        approval_receipt: approvalReceipt as any,
        options: {
          allowDirtyTreeForTest: true,
        },
      },
      context,
    );

    expect(result).toBeDefined();
    expect((result as any).dry_run).toBe(true);
    expect((result as any).mutations_applied).toBe(0);

    // Verify file was NOT created on disk
    const targetFile = path.join(tempDir, "app", "models", "new_model.rb");
    let fileExists = false;
    try {
      await fs.stat(targetFile);
      fileExists = true;
    } catch {}

    expect(fileExists).toBe(false);
  });
});
