import type { VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class RollbackValidator {
  public static validate(slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const hasMigration = slicePlan.databaseChanges.length > 0;
    const rollback = slicePlan.rollbackPlan;

    if (hasMigration) {
      const isRollbackGuaranteed = rollback && rollback.safeRollbackGuaranteed && rollback.steps.length > 0;
      checks.push({
        id: "ROL-001-MIGRATION-ROLLBACK",
        name: "Migration Rollback Strategy & Contingency",
        category: "ROLLBACK_SAFETY",
        status: "STATIC",
        verdict: isRollbackGuaranteed ? "PASS" : "FAIL",
        severity: isRollbackGuaranteed ? "INFO" : "BLOCKER",
        message: isRollbackGuaranteed
          ? `Verified safe rollback strategy (${rollback.strategy}) with ${rollback.steps.length} contingency steps.`
          : "Database migration lacks an automated, reversible rollback plan (NO ROLLBACK PLAN -> NO MIGRATION violation)."
      });
    } else {
      checks.push({
        id: "ROL-001-NO-MIGRATION-ROLLBACK",
        name: "Rollback Strategy",
        category: "ROLLBACK_SAFETY",
        status: "STATIC",
        verdict: "PASS",
        severity: "INFO",
        message: "No database migrations require rollback procedures."
      });
    }

    return checks;
  }
}
