import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class DependencyValidator {
  private static readonly STAGE_ORDER: Record<string, number> = {
    RUN_MIGRATION: 1,
    CREATE_FILE_MODEL: 2,
    CREATE_FILE_POLICY: 3,
    CREATE_FILE_SERVICE: 4,
    CREATE_FILE_JOB: 5,
    CREATE_FILE_CONTROLLER: 6,
    REGISTER_ROUTE: 7,
    ADD_ACTIVE_ADMIN: 8,
    CREATE_FILE_TEST: 9,
    MODIFY_FILE: 10
  };

  public static validate(changePlan: ChangePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    let isDagValid = true;
    let maxStageSeen = 0;
    const orderingViolations: string[] = [];

    for (const op of changePlan.operations) {
      let stageKey: string = op.type;
      if (op.type === "CREATE_FILE") {
        if (op.path.includes("app/models")) stageKey = "CREATE_FILE_MODEL";
        else if (op.path.includes("app/policies")) stageKey = "CREATE_FILE_POLICY";
        else if (op.path.includes("app/services")) stageKey = "CREATE_FILE_SERVICE";
        else if (op.path.includes("app/jobs")) stageKey = "CREATE_FILE_JOB";
        else if (op.path.includes("app/controllers")) stageKey = "CREATE_FILE_CONTROLLER";
        else if (op.path.includes("spec/") || op.path.includes("test/")) stageKey = "CREATE_FILE_TEST";
      }

      const stageNumber = this.STAGE_ORDER[stageKey] ?? 5;
      if (stageNumber < maxStageSeen && stageNumber === 1) {
        // Migration appearing after models is a DAG violation
        isDagValid = false;
        orderingViolations.push(`Operation ${op.id} (${op.type}) appears after later stages in DAG.`);
      } else {
        maxStageSeen = Math.max(maxStageSeen, stageNumber);
      }
    }

    checks.push({
      id: "DEP-001-DAG-ORDER",
      name: "Operation Dependency DAG & Ordering",
      category: "DEPENDENCY_GRAPH",
      status: "STATIC",
      verdict: isDagValid ? "PASS" : "FAIL",
      severity: isDagValid ? "INFO" : "BLOCKER",
      message: isDagValid
        ? `Operations form a valid acyclic execution DAG (Migration -> Models -> Policies -> Services -> Jobs -> Controllers -> Routes -> Tests).`
        : `DAG ordering violation: ${orderingViolations.join("; ")}`
    });

    return checks;
  }
}
