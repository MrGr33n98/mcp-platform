import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import { ImpactAnalyzer } from "@mcp-platform/architecture-graph";
import type { VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import type { BlastRadius } from "../types.js";

export class BlastRadiusAnalyzer {
  public static analyze(graph: ArchitectureGraphData, slicePlan: VerticalSlicePlan): BlastRadius {
    const analyzer = new ImpactAnalyzer(graph);
    const direct: string[] = [];
    const transitive: string[] = [];
    const critical: string[] = [];
    const testsProtecting: string[] = [];

    // 1. Identify direct neighbors
    const tenantModel = slicePlan.existingPatterns.models.tenancyAssociation.replace("belongs_to :", "").trim();
    const capitalizedTenant = tenantModel.charAt(0).toUpperCase() + tenantModel.slice(1);
    const tenantNodeId = `model:${capitalizedTenant}`;

    const tenantNode = analyzer.getNode(tenantNodeId);
    if (tenantNode) {
      direct.push(`Model: ${capitalizedTenant} (receives association)`);
      critical.push(`Model: ${capitalizedTenant} (Core Tenancy Boundary)`);

      // Find tests protecting tenant model
      const protectingSpecs = analyzer.whatTestsProtectComponent(tenantNodeId);
      for (const spec of protectingSpecs) {
        testsProtecting.push(`${spec.name} (${spec.file})`);
      }

      // Find transitive downstream nodes
      const downstream = analyzer.getDownstreamDependencies(tenantNodeId);
      for (const d of downstream) {
        if (!direct.includes(`${d.type}: ${d.name}`)) {
          transitive.push(`${d.type}: ${d.name}`);
        }
      }
    }

    // 2. Identify planned controllers
    for (const ctrl of slicePlan.controllers) {
      direct.push(`Controller: ${ctrl.name}`);
    }

    // 3. Identify planned jobs
    for (const job of slicePlan.jobs) {
      direct.push(`Job: ${job.name}`);
    }

    const uniqueDirect = Array.from(new Set(direct));
    const uniqueTransitive = Array.from(new Set(transitive));
    const uniqueCritical = Array.from(new Set(critical));
    const uniqueTests = Array.from(new Set(testsProtecting));

    return {
      direct: uniqueDirect,
      transitive: uniqueTransitive,
      critical: uniqueCritical,
      testsProtecting: uniqueTests,
      impactedComponentsCount: uniqueDirect.length + uniqueTransitive.length
    };
  }
}
