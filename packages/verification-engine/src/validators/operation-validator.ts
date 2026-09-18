import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class OperationValidator {
  public static validate(changePlan: ChangePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const duplicatePaths = new Set<string>();
    const seenPaths = new Set<string>();

    for (const op of changePlan.operations) {
      if (seenPaths.has(op.path) && op.type !== "REGISTER_ROUTE") {
        duplicatePaths.add(op.path);
      }
      seenPaths.add(op.path);

      const isValidPath = op.path && !op.path.includes("..") && !op.path.startsWith("/");
      checks.push({
        id: `OP-VAL-${op.id}`,
        name: `Operation Path Safety: ${op.id}`,
        category: "OPERATION_INTEGRITY",
        status: "STATIC",
        verdict: isValidPath ? "PASS" : "FAIL",
        severity: isValidPath ? "INFO" : "BLOCKER",
        message: isValidPath
          ? `Path '${op.path}' is relative and well-formed.`
          : `Dangerous or invalid path '${op.path}' in operation ${op.id}.`
      });
    }

    const hasNoDuplicates = duplicatePaths.size === 0;
    checks.push({
      id: "OP-VAL-NO-DUPLICATE-PATHS",
      name: "Duplicate File Creation Detection",
      category: "OPERATION_INTEGRITY",
      status: "STATIC",
      verdict: hasNoDuplicates ? "PASS" : "FAIL",
      severity: hasNoDuplicates ? "INFO" : "BLOCKER",
      message: hasNoDuplicates
        ? "No duplicate file creation collisions detected in plan."
        : `Duplicate target paths found: ${Array.from(duplicatePaths).join(", ")}`
    });

    return checks;
  }
}
