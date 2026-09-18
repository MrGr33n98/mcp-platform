import { VerificationReportBuilder } from "@mcp-platform/verification-engine";
import type { ChangePlan } from "@mcp-platform/feature-engineering";

export class PlanValidator {
  public static validate(changePlan: ChangePlan): { valid: boolean; reason?: string; digest: string } {
    if (!changePlan || typeof changePlan !== "object") {
      return { valid: false, reason: "ChangePlan must be a valid object.", digest: "" };
    }

    if (changePlan.schema_version !== 1) {
      return { valid: false, reason: `Unsupported ChangePlan schema version: ${changePlan.schema_version}`, digest: "" };
    }

    if (!Array.isArray(changePlan.operations) || changePlan.operations.length === 0) {
      return { valid: false, reason: "ChangePlan contains no operations.", digest: "" };
    }

    const digest = VerificationReportBuilder.calculatePlanDigest(changePlan);
    return { valid: true, digest };
  }
}
