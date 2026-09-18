import { createHash } from "crypto";
import type { ChangeOperation, ChangePlan } from "@mcp-platform/feature-engineering";
import type {
  BlastRadius,
  ChangeSurfaceReport,
  FailureSeverity,
  RepositoryRevision,
  SecurityFinding,
  VerificationCheckResult,
  VerificationMode,
  VerificationReceipt,
  VerificationReport,
  VerificationStatus
} from "../types.js";

export class VerificationReportBuilder {
  public static calculatePlanDigest(changePlan: ChangePlan): string {
    const canonical = JSON.stringify({
      schema_version: changePlan.schema_version,
      product: changePlan.product,
      capability: changePlan.capability,
      operations: changePlan.operations.map((op: ChangeOperation) => ({
        id: op.id,
        type: op.type,
        path: op.path,
        patternApplied: op.patternApplied
      }))
    });
    return createHash("sha256").update(canonical).digest("hex");
  }

  public static build(params: {
    target: { product: string; capability: string };
    changePlan: ChangePlan;
    repositoryRevision: RepositoryRevision;
    mode: VerificationMode;
    checks: VerificationCheckResult[];
    securityFindings: SecurityFinding[];
    changeSurface: ChangeSurfaceReport;
    blastRadius: BlastRadius;
    commandsExecuted?: Array<{ command: string; duration_ms: number; status: "OK" | "FAILED" }>;
    commandsBlocked?: Array<{ command: string; reason: string }>;
  }): { report: VerificationReport; receipt: VerificationReceipt } {
    const verificationId = `VERIF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const planDigest = this.calculatePlanDigest(params.changePlan);

    const failures: Array<{ checkId: string; message: string; severity: FailureSeverity }> = [];
    const warnings: Array<{ checkId: string; message: string }> = [];
    const notVerified: string[] = [];

    let hasBlocker = false;
    let passedCount = 0;
    let failedCount = 0;
    let warningCount = 0;
    let notVerifiedCount = 0;

    for (const check of params.checks) {
      if (check.verdict === "PASS") {
        passedCount++;
      } else if (check.verdict === "FAIL") {
        failedCount++;
        failures.push({
          checkId: check.id,
          message: check.message,
          severity: check.severity
        });
        if (check.severity === "BLOCKER") {
          hasBlocker = true;
        }
      } else if (check.verdict === "WARNING") {
        warningCount++;
        warnings.push({
          checkId: check.id,
          message: check.message
        });
      } else if (check.verdict === "NOT_VERIFIED") {
        notVerifiedCount++;
        notVerified.push(`${check.id}: ${check.message}`);
      }
    }

    let status: VerificationStatus = "PASS";
    if (hasBlocker || failedCount > 0) {
      status = "FAIL";
    } else if (notVerifiedCount > 0 || warningCount > 0) {
      status = "CONDITIONAL_PASS";
    }

    const report: VerificationReport = {
      schema_version: 1,
      verification_id: verificationId,
      created_at: new Date().toISOString(),
      target: params.target,
      repository_revision: params.repositoryRevision,
      change_plan_digest: planDigest,
      status,
      mode: params.mode,
      checks: params.checks,
      evidence: [],
      failures,
      warnings,
      security_findings: params.securityFindings,
      commands_executed: params.commandsExecuted || [],
      commands_blocked: params.commandsBlocked || [],
      assumptions: [
        "Repository revision is bound to execution context; any new commit invalidates this verification.",
        "Verification was executed in VERIFY_ONLY mode without making filesystem mutations."
      ],
      not_verified: notVerified,
      coverage: {
        totalChecks: params.checks.length,
        passedChecks: passedCount,
        failedChecks: failedCount,
        warningChecks: warningCount,
        notVerifiedCount: notVerifiedCount
      },
      change_surface: params.changeSurface,
      blast_radius: params.blastRadius,
      approval_status: "AWAITING_HUMAN_APPROVAL"
    };

    const receiptDigest = createHash("sha256")
      .update(`${verificationId}:${planDigest}:${params.repositoryRevision.commitSha}:${status}`)
      .digest("hex");

    const receipt: VerificationReceipt = {
      schema_version: 1,
      receipt_type: "VERIFICATION_RECEIPT",
      verification_id: verificationId,
      change_plan_digest: planDigest,
      repository_revision: params.repositoryRevision,
      verification_status: status,
      verification_digest: receiptDigest,
      timestamp: report.created_at
    };

    return { report, receipt };
  }
}
