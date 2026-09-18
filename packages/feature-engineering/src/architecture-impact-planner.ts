import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import { ImpactAnalyzer } from "@mcp-platform/architecture-graph";
import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern } from "./types.js";

export interface ArchitectureImpactResult {
  affectedComponents: string[];
  existingNeighbors: string[];
  namingConflicts: string[];
  risks: string[];
  assumptions: string[];
}

export class ArchitectureImpactPlanner {
  public static planImpact(
    definition: ResolvedCapabilityDefinition,
    graph: ArchitectureGraphData,
    pattern: CodePattern
  ): ArchitectureImpactResult {
    const analyzer = new ImpactAnalyzer(graph);
    const affectedComponents: string[] = [];
    const existingNeighbors: string[] = [];
    const namingConflicts: string[] = [];
    const risks: string[] = [];
    const assumptions: string[] = [];

    // 1. Check Tenancy Model Neighbor
    const tenantModelName = pattern.models.tenancyAssociation.replace("belongs_to :", "").trim();
    const capitalizedTenant = tenantModelName.charAt(0).toUpperCase() + tenantModelName.slice(1);
    const tenantNode = analyzer.getNode(`model:${capitalizedTenant}`);

    if (tenantNode) {
      existingNeighbors.push(`model:${capitalizedTenant}`);
      affectedComponents.push(`Model: ${capitalizedTenant} (will receive has_many associations)`);
    } else {
      assumptions.push(`Expected tenant model '${capitalizedTenant}' to exist; fallback to generic organization.`);
    }

    // 2. Check for Naming Conflicts with Planned Domain Objects
    for (const domainObj of definition.domainObjects) {
      const existingModel = analyzer.getNode(`model:${domainObj}`);
      if (existingModel) {
        namingConflicts.push(`Model '${domainObj}' already exists in architecture graph at ${existingModel.file}`);
      }
    }

    // 3. Check for Controller Conflicts
    for (const ctrl of definition.controllers) {
      const existingCtrl = analyzer.getNode(`controller:${ctrl}`);
      if (existingCtrl) {
        namingConflicts.push(`Controller '${ctrl}' already exists in architecture graph at ${existingCtrl.file}`);
      }
    }

    // 4. Check for Job Conflicts
    for (const job of definition.jobs) {
      const existingJob = analyzer.getNode(`job:${job}`);
      if (existingJob) {
        namingConflicts.push(`Job '${job}' already exists in architecture graph at ${existingJob.file}`);
      }
    }

    // 5. Evaluate Downstream / Upstream Risks
    if (definition.securityRequirements.ssrfProtection) {
      risks.push("Outgoing webhook requests might target internal private network IPs if SSRF validator is bypassed.");
    }
    if (definition.securityRequirements.signedPayload) {
      risks.push("Webhook signing secret must be encrypted with AES-256-GCM; key rotation must preserve previous secret during grace period.");
    }
    if (definition.jobs.length > 0) {
      risks.push("Webhook delivery volume spikes could saturate background queues if not isolated in a dedicated queue.");
    }

    assumptions.push(`Rails backend supports ActiveJob with ${pattern.jobs.baseClass} and Sidekiq backend.`);
    assumptions.push(`Database supports ${pattern.models.idType.toUpperCase()} primary keys and PostgreSQL JSONB columns.`);

    return {
      affectedComponents,
      existingNeighbors,
      namingConflicts,
      risks,
      assumptions
    };
  }
}
