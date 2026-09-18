import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type { GapReport } from "@mcp-platform/saas-gap-analyzer";
import type { VerticalSlicePlan } from "./types.js";
import { PatternFinder } from "./pattern-finder.js";
import { CapabilitySelector } from "./capability-selector.js";
import { RequirementResolver } from "./requirement-resolver.js";
import { ArchitectureImpactPlanner } from "./architecture-impact-planner.js";
import { MigrationPlanner } from "./migration-planner.js";
import { ModelPlanner } from "./model-planner.js";
import { PolicyPlanner } from "./policy-planner.js";
import { ServicePlanner } from "./service-planner.js";
import { JobPlanner } from "./job-planner.js";
import { ControllerPlanner } from "./controller-planner.js";
import { APIContractPlanner } from "./api-contract-planner.js";
import { ActiveAdminPlanner } from "./active-admin-planner.js";
import { FrontendPlanner } from "./frontend-planner.js";
import { TestPlanner } from "./test-planner.js";
import { VerificationPlanner } from "./verification-planner.js";

export class InvariantViolationError extends Error {
  constructor(public rule: string, message: string) {
    super(`[INVARIANT VIOLATION: ${rule}] ${message}`);
    this.name = "InvariantViolationError";
  }
}

export class VerticalSlicePlanner {
  public static plan(
    manifest: RepositoryManifest,
    graph: ArchitectureGraphData,
    gapReport: GapReport,
    targetCapabilityId?: string | undefined
  ): VerticalSlicePlan {
    // 1. Identify Existing Patterns (How THIS SaaS already does things)
    const patterns = PatternFinder.findPatterns(manifest, graph);

    // 2. Select Capability from Gaps
    const capabilityAudit = CapabilitySelector.selectCapability(gapReport, targetCapabilityId);

    // 3. Resolve Requirements
    const { definition, requirements, unresolvedGaps } = RequirementResolver.resolve(capabilityAudit, patterns);

    // 4. Plan Architecture Impact
    const impact = ArchitectureImpactPlanner.planImpact(definition, graph, patterns);

    // 5. Layer Planning
    const { migrationPlan, rollbackPlan } = MigrationPlanner.planMigration(definition, patterns);
    const models = ModelPlanner.planModels(definition, patterns);
    const policies = PolicyPlanner.planPolicies(definition, patterns);
    const services = ServicePlanner.planServices(definition, patterns);
    const jobs = JobPlanner.planJobs(definition, patterns);
    const controllers = ControllerPlanner.planControllers(definition, patterns);
    const routes = APIContractPlanner.planRoutes(definition);
    const apiContracts = APIContractPlanner.planContracts(definition);
    const activeAdmin = ActiveAdminPlanner.planActiveAdmin(definition, patterns);
    const frontendChanges = FrontendPlanner.planFrontend(definition, patterns);
    const tests = TestPlanner.planTests(definition, patterns);
    const securityChecks = VerificationPlanner.planSecurityChecks(definition);
    const verificationPlan = VerificationPlanner.planVerification(definition);

    // 6. INVARIANT CHECKS (Strict Gate Enforcements)
    // Rule: NO TEST PLAN -> NO CHANGE
    if (tests.length === 0) {
      throw new InvariantViolationError("NO TEST PLAN -> NO CHANGE", "Cannot propose vertical slice changes without an accompanying automated test plan.");
    }

    // Rule: NO ROLLBACK PLAN -> NO MIGRATION
    if (migrationPlan.changes.length > 0 && (!rollbackPlan || !rollbackPlan.safeRollbackGuaranteed || rollbackPlan.steps.length === 0)) {
      throw new InvariantViolationError("NO ROLLBACK PLAN -> NO MIGRATION", "Cannot propose database migrations without a verified, reversible rollback plan.");
    }

    // Rule: NO POLICY -> NO TENANT-SCOPED ENDPOINT
    if (controllers.length > 0 && policies.length === 0) {
      throw new InvariantViolationError("NO POLICY -> NO TENANT-SCOPED ENDPOINT", "Cannot expose tenant-scoped API controllers without a Pundit authorization policy.");
    }

    return {
      capability: definition.id,
      title: definition.name,
      description: `Vertical slice engineering plan for ${definition.name} (${definition.category}) conforming to Golden SaaS Blueprint.`,
      requirements,
      currentEvidence: capabilityAudit.evidence,
      gaps: unresolvedGaps,
      affectedComponents: impact.affectedComponents,
      existingPatterns: patterns,
      databaseChanges: migrationPlan.changes,
      models,
      policies,
      services,
      jobs,
      controllers,
      routes,
      apiContracts,
      activeAdmin,
      frontendChanges,
      tests,
      securityChecks,
      migrationPlan,
      rollbackPlan,
      verificationPlan,
      risks: impact.risks,
      assumptions: impact.assumptions,
      unresolvedQuestions: []
    };
  }
}
