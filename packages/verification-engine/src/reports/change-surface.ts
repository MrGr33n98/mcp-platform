import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { ChangeSurfaceReport } from "../types.js";

export class ChangeSurfaceAnalyzer {
  public static analyze(changePlan: ChangePlan): ChangeSurfaceReport {
    const filesToCreate: string[] = [];
    const filesToModify: string[] = [];
    const tablesAffected: string[] = [];
    const routesAffected: string[] = [];
    const modelsAffected: string[] = [];
    const policiesAffected: string[] = [];
    const jobsAffected: string[] = [];
    const frontendAffected: string[] = [];
    const testsAffected: string[] = [];

    for (const op of changePlan.operations) {
      if (op.type === "CREATE_FILE") {
        filesToCreate.push(op.path);
        if (op.path.includes("app/models")) modelsAffected.push(op.path);
        if (op.path.includes("app/policies")) policiesAffected.push(op.path);
        if (op.path.includes("app/jobs")) jobsAffected.push(op.path);
        if (op.path.includes("spec/") || op.path.includes("test/")) testsAffected.push(op.path);
        if (op.path.includes("components/") || op.path.includes("app/(")) frontendAffected.push(op.path);
      } else if (op.type === "MODIFY_FILE") {
        filesToModify.push(op.path);
      } else if (op.type === "RUN_MIGRATION") {
        filesToCreate.push(op.path);
        const match = op.description.match(/\(([^)]+)\)/);
        if (match && match[1]) {
          tablesAffected.push(...match[1].split(",").map((t: string) => t.trim()));
        }
      } else if (op.type === "REGISTER_ROUTE") {
        routesAffected.push(op.path);
      } else if (op.type === "ADD_ACTIVE_ADMIN") {
        filesToCreate.push(op.path);
      }
    }

    return {
      files_to_create: filesToCreate,
      files_to_modify: filesToModify,
      tables_affected: Array.from(new Set(tablesAffected)),
      routes_affected: Array.from(new Set(routesAffected)),
      models_affected: Array.from(new Set(modelsAffected)),
      policies_affected: Array.from(new Set(policiesAffected)),
      jobs_affected: Array.from(new Set(jobsAffected)),
      frontend_affected: Array.from(new Set(frontendAffected)),
      tests_affected: Array.from(new Set(testsAffected)),
      total_operations: changePlan.operations.length
    };
  }
}
