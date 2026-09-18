import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitGovernanceEngine } from "../src/git-governance-engine.js";
import { ApplyReceiptValidator } from "../src/preflight/apply-receipt-validator.js";
import { MockPullRequestProvider } from "../src/pr/pr-provider.js";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitApprovalReceipt } from "../src/types.js";

const execFileAsync = promisify(execFile);

describe("GitGovernanceEngine End-to-End Canary in Isolated Repository", () => {
  let tmpRepoDir: string;
  let baseCommitSha: string;
  const secretKey = "test_git_gov_secret_key";

  beforeEach(async () => {
    ApplyReceiptValidator.clearNonceCacheForTesting();

    // Create temporary workspace
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp_git_gov_canary_"));

    // Init real git repository
    await execFileAsync("git", ["init", "-b", "main"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.name", "Canary Runner"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.email", "canary@mcp-platform.local"], { cwd: tmpRepoDir });

    // Create base commit on main
    fs.writeFileSync(path.join(tmpRepoDir, "README.md"), "# Test Repo\nInitial base content.\n", "utf8");
    await execFileAsync("git", ["add", "README.md"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["commit", "-m", "chore: initial commit"], { cwd: tmpRepoDir });

    const revRes = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: tmpRepoDir });
    baseCommitSha = revRes.stdout.trim();
  });

  afterEach(() => {
    if (fs.existsSync(tmpRepoDir)) {
      try {
        fs.rmSync(tmpRepoDir, { recursive: true, force: true });
      } catch {
        // Ignore on windows if locked temporarily
      }
    }
  });

  it("successfully performs isolated branch, selective staging, secret scanning, commit and PR creation", async () => {
    // 1. Simulate an applied change from apply-engine
    const modelDir = path.join(tmpRepoDir, "app", "models");
    fs.mkdirSync(modelDir, { recursive: true });
    const webhookFile = path.join(modelDir, "webhook_endpoint.rb");
    fs.writeFileSync(
      webhookFile,
      `class WebhookEndpoint < ApplicationRecord\n  belongs_to :enterprise\n  validates :url, presence: true\nend\n`,
      "utf8"
    );

    const relativePath = "app/models/webhook_endpoint.rb";

    const changePlan: ChangePlan = {
      schema_version: 1,
      mode: "PLAN_ONLY",
      product: "oest",
      capability: "outgoing-webhooks",
      operations: [
        {
          id: "op_001",
          type: "CREATE_FILE",
          path: relativePath,
          description: "Webhook model definition",
          patternApplied: "MODEL_PATTERN",
        },
      ],
      verification: [],
      rollback: [],
      approval_required: true,
    };

    const verticalSlicePlan: VerticalSlicePlan = {
      capability: "outgoing-webhooks",
      title: "Add Outgoing Webhooks Delivery",
      description: "Automated webhook delivery infrastructure for tenant notifications.",
      requirements: [],
      currentEvidence: [],
      gaps: [],
      affectedComponents: ["app/models/webhook_endpoint.rb"],
      existingPatterns: {} as any,
      databaseChanges: [],
      models: [],
      policies: [],
      services: [],
      jobs: [],
      controllers: [],
      routes: [],
      apiContracts: [],
      activeAdmin: [],
      frontendChanges: [],
      tests: [],
      securityChecks: [],
      migrationPlan: {
        migrationName: "create_webhook_endpoints",
        versionTag: "20260917001",
        filename: "db/migrate/20260917001_create_webhook_endpoints.rb",
        targetPath: "db/migrate/20260917001_create_webhook_endpoints.rb",
        rubyCode: "",
        changes: [],
        reversible: true,
      },
      rollbackPlan: {
        strategy: "MIGRATION_DOWN",
        steps: [],
        dataLossRisk: "LOW",
        safeRollbackGuaranteed: true,
      },
      verificationPlan: { preConditions: [], checks: [], postConditions: [] },
      risks: ["LOW"],
      assumptions: [],
      unresolvedQuestions: [],
    };

    const applyReceipt: ApplyReceipt = {
      schema_version: 1,
      receipt_type: "APPLY_RECEIPT",
      apply_id: "apply_tx_canary_001",
      change_plan_digest: "digest_plan_12345",
      verification_digest: "digest_verif_12345",
      approval_id: "approval_apply_001",
      repository_before: {
        commitSha: baseCommitSha,
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      applied_change_digest: "digest_applied_12345",
      status: "APPLIED_VERIFIED",
      timestamp: new Date().toISOString(),
    };

    const receiptWithoutSig: Omit<GitApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "git_approval_canary_001",
      approver_id: "lead_architect",
      approver_type: "HUMAN_OPERATOR",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      apply_id: "apply_tx_canary_001",
      change_plan_digest: "digest_plan_12345",
      verification_digest: "digest_verif_12345",
      repository_revision: {
        commitSha: baseCommitSha,
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      workspace_id: "ws_canary",
      scope: {
        scopes: ["CREATE_BRANCH", "STAGE", "COMMIT", "CREATE_PR"],
      },
      nonce: "nonce_canary_e2e_1",
    };

    const sig = ApplyReceiptValidator.computeSignature(receiptWithoutSig, secretKey);
    const gitApprovalReceipt: GitApprovalReceipt = {
      ...receiptWithoutSig,
      signature_or_mac: sig,
    };

    const prProvider = new MockPullRequestProvider();

    // Execute Git Governance Engine
    const result = await GitGovernanceEngine.execute({
      workspaceRoot: tmpRepoDir,
      changePlan,
      verticalSlicePlan,
      applyReceipt,
      verificationReceipt: {
        schema_version: 1,
        receipt_type: "VERIFICATION_RECEIPT",
        verification_id: "verif_canary_001",
        change_plan_digest: "digest_plan_12345",
        repository_revision: {
          commitSha: baseCommitSha,
          branch: "main",
          dirty: false,
          capturedAt: new Date().toISOString(),
        },
        verification_status: "PASS",
        verification_digest: "digest_verif_12345",
        timestamp: new Date().toISOString(),
      },
      gitApprovalReceipt,
      prProvider,
      options: {
        customSecretKey: secretKey,
      },
    });

    // Assertions
    expect(result.report.status).toBe("PR_CREATED");
    expect(result.receipt).toBeDefined();
    expect(result.receipt?.receipt_type).toBe("GIT_RECEIPT");
    expect(result.receipt?.commit_sha).toBeDefined();
    expect(result.receipt?.commit_sha).not.toBe(baseCommitSha);
    expect(result.report.branch).toMatch(/^mcp\/outgoing-webhooks\//);
    expect(result.report.secret_findings.length).toBe(0);
    expect(result.report.diff_report.is_consistent_with_plan).toBe(true);
    expect(result.report.commit_report?.verification_status).toBe("VERIFIED");
    expect(result.report.pr_report?.status).toBe("CREATED");

    // Verify main branch in git is unchanged
    await execFileAsync("git", ["switch", "main"], { cwd: tmpRepoDir });
    const mainRev = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: tmpRepoDir });
    expect(mainRev.stdout.trim()).toBe(baseCommitSha);

    // Verify file does NOT exist on main
    expect(fs.existsSync(webhookFile)).toBe(false);

    // Verify file DOES exist on the isolated branch
    await execFileAsync("git", ["switch", result.report.branch], { cwd: tmpRepoDir });
    expect(fs.existsSync(webhookFile)).toBe(true);
  });

  it("blocks commit and rolls back when a secret is detected in diff", async () => {
    // Write file with a fake Stripe live secret
    const modelDir = path.join(tmpRepoDir, "app", "services");
    fs.mkdirSync(modelDir, { recursive: true });
    const serviceFile = path.join(modelDir, "payment_service.rb");
    const fakeStripe = ["sk", "live", "1234567890abcdef1234567890abcdef"].join("_");
    fs.writeFileSync(
      serviceFile,
      `class PaymentService\n  STRIPE_KEY = "${fakeStripe}"\nend\n`,
      "utf8"
    );

    const relativePath = "app/services/payment_service.rb";

    const changePlan: ChangePlan = {
      schema_version: 1,
      mode: "PLAN_ONLY",
      product: "oest",
      capability: "payments",
      operations: [
        {
          id: "op_leak_001",
          type: "CREATE_FILE",
          path: relativePath,
          description: "Payment service",
          patternApplied: "SERVICE_PATTERN",
        },
      ],
      verification: [],
      rollback: [],
      approval_required: true,
    };

    const applyReceipt: ApplyReceipt = {
      schema_version: 1,
      receipt_type: "APPLY_RECEIPT",
      apply_id: "apply_leak_001",
      change_plan_digest: "digest_leak_123",
      verification_digest: "digest_verif_leak",
      approval_id: "approval_leak_001",
      repository_before: {
        commitSha: baseCommitSha,
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      applied_change_digest: "digest_applied_leak",
      status: "APPLIED_VERIFIED",
      timestamp: new Date().toISOString(),
    };

    const receiptWithoutSig: Omit<GitApprovalReceipt, "signature_or_mac"> = {
      schema_version: 1,
      approval_id: "git_approval_leak_001",
      approver_id: "sec_officer",
      approver_type: "SECURITY_OFFICER",
      approved_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      apply_id: "apply_leak_001",
      change_plan_digest: "digest_leak_123",
      verification_digest: "digest_verif_leak",
      repository_revision: {
        commitSha: baseCommitSha,
        branch: "main",
        dirty: false,
        capturedAt: new Date().toISOString(),
      },
      workspace_id: "ws_leak",
      scope: {
        scopes: ["CREATE_BRANCH", "STAGE", "COMMIT"],
      },
      nonce: "nonce_leak_canary",
    };

    const sig = ApplyReceiptValidator.computeSignature(receiptWithoutSig, secretKey);
    const gitApprovalReceipt: GitApprovalReceipt = {
      ...receiptWithoutSig,
      signature_or_mac: sig,
    };

    const result = await GitGovernanceEngine.execute({
      workspaceRoot: tmpRepoDir,
      changePlan,
      applyReceipt,
      verificationReceipt: {
        schema_version: 1,
        receipt_type: "VERIFICATION_RECEIPT",
        verification_id: "verif_leak_001",
        change_plan_digest: "digest_leak_123",
        repository_revision: {
          commitSha: baseCommitSha,
          branch: "main",
          dirty: false,
          capturedAt: new Date().toISOString(),
        },
        verification_status: "PASS",
        verification_digest: "digest_verif_leak",
        timestamp: new Date().toISOString(),
      },
      gitApprovalReceipt,
      options: {
        customSecretKey: secretKey,
      },
    });

    expect(result.report.status).toBe("FAILED");
    expect(result.report.error).toContain("Secret scanning BLOCKED commit");
    expect(result.report.secret_findings.some(f => f.secret_type === "Stripe Secret Key")).toBe(true);
    expect(result.receipt).toBeUndefined();
  });
});
