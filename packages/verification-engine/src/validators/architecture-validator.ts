import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { VerificationCheckResult } from "../types.js";

export class ArchitectureValidator {
  public static validate(graph: ArchitectureGraphData, slicePlan: VerticalSlicePlan): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const existingNodeIds = new Set(graph.nodes.map((n) => n.id));
    const collisions: string[] = [];

    for (const model of slicePlan.models) {
      if (existingNodeIds.has(`model:${model.className}`)) {
        collisions.push(`Model '${model.className}'`);
      }
    }

    const noCollisions = collisions.length === 0;
    checks.push({
      id: "ARCH-001-NO-COLLISIONS",
      name: "Architecture Graph Symbol Collision Check",
      category: "ARCHITECTURE_GRAPH",
      status: "STATIC",
      verdict: noCollisions ? "PASS" : "WARNING",
      severity: noCollisions ? "INFO" : "WARNING",
      message: noCollisions
        ? "No unexpected symbol collisions with existing architecture graph nodes."
        : `Potential symbol collisions detected: ${collisions.join(", ")}`
    });

    return checks;
  }
}
