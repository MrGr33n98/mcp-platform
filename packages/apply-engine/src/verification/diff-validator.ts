import type { ActualChangeSurface, DiffReport } from "../types.js";
import type { ChangePlan } from "@mcp-platform/feature-engineering";

export class DiffValidator {
  public static validate(params: {
    changePlan: ChangePlan;
    actualSurface: ActualChangeSurface;
  }): DiffReport {
    const plannedPaths = params.changePlan.operations.map(op => op.path);
    const actualTouchedPaths = [...params.actualSurface.files_created, ...params.actualSurface.files_modified, ...params.actualSurface.files_deleted];

    const unexpectedMutations = actualTouchedPaths.filter(p => !plannedPaths.includes(p));
    const missingMutations = plannedPaths.filter(p => !actualTouchedPaths.includes(p));

    const matchesPlan = unexpectedMutations.length === 0 && missingMutations.length === 0;

    let plannedCreated = 0;
    let plannedModified = 0;
    let plannedDeleted = 0;

    for (const op of params.changePlan.operations) {
      if (op.type === "CREATE_FILE" || op.type === "RUN_MIGRATION") {
        plannedCreated++;
      } else if (op.type === "MODIFY_FILE") {
        plannedModified++;
      }
    }

    return {
      planned_surface: {
        created_count: plannedCreated,
        modified_count: plannedModified,
        deleted_count: plannedDeleted,
        paths: plannedPaths
      },
      actual_surface: params.actualSurface,
      matches_plan: matchesPlan,
      unexpected_mutations: unexpectedMutations,
      missing_mutations: missingMutations
    };
  }
}
