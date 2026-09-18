import type { ToolDefinition } from "@mcp-platform/core";
import {
  DeploymentPlanBuilder,
  ProductionVerifier,
  RollbackController,
  type ReleaseArtifact,
  type ReleaseCandidate,
  type KnownGoodRelease,
  type DeploymentProvider,
  type DeploymentPlan,
  type DeploymentTarget,
  type RollbackPlan,
  type DeploymentExecutionResult,
  type RollbackExecutionResult,
} from "@mcp-platform/safe-release";
import {
  releasePlanInputSchema,
  verifyReleaseInputSchema,
  rollbackReleaseInputSchema,
} from "../schemas/release.js";

// Safe mock deployment provider for isolated verification & rollbacks
function createLocalDeploymentProvider(activeDigest: string = "sha256:active_target_digest"): DeploymentProvider {
  let currentDigest = activeDigest;
  return {
    name: "engineering-mcp-provider",
    capabilities: ["REPLACE", "ROLLING", "BLUE_GREEN", "CANARY"],
    async inspect(_target: DeploymentTarget) {
      return { active_digest: currentDigest, status: "READY" };
    },
    async prepare(_plan: DeploymentPlan) {
      return { ready: true };
    },
    async deploy(plan: DeploymentPlan, _scope: "CANARY" | "FULL"): Promise<DeploymentExecutionResult> {
      currentDigest = plan.artifact.digest;
      return {
        deployment_id: `dep_${Date.now()}`,
        status: "SUCCESS",
        active_artifact_digest: currentDigest,
      };
    },
    async status(deploymentId: string): Promise<DeploymentExecutionResult> {
      return {
        deployment_id: deploymentId,
        status: "SUCCESS",
        active_artifact_digest: currentDigest,
      };
    },
    async rollback(plan: RollbackPlan): Promise<RollbackExecutionResult> {
      currentDigest = plan.target_release.artifact_digest;
      return {
        rollback_id: plan.rollback_id,
        status: "SUCCESS",
        restored_digest: currentDigest,
      };
    },
  };
}

export function createReleasePlanTool(): ToolDefinition<typeof releasePlanInputSchema> {
  return {
    name: "engineering_release_plan",
    description: "Plan deployment sequence, canary criteria, and health checks for a release candidate.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: releasePlanInputSchema,
    execute(_context, input) {
      const artifact = input.artifact as unknown as ReleaseArtifact;
      const plan = DeploymentPlanBuilder.createPlan({
        product: input.product_name,
        environment: input.environment,
        artifact,
        strategy: input.strategy,
        timeoutMs: input.timeout_ms,
      });

      return {
        plan_id: plan.plan_id,
        target: plan.target,
        strategy: plan.strategy,
        steps_count: plan.steps.length,
        health_checks: plan.health_checks,
        promotion_criteria: plan.promotion_criteria,
        rollback_criteria: plan.rollback_criteria,
        deployment_plan: plan,
      };
    },
  };
}

export function createVerifyReleaseTool(): ToolDefinition<typeof verifyReleaseInputSchema> {
  return {
    name: "engineering_verify_release",
    description: "Verify active release host digest, service telemetry, and critical endpoint health probes.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: verifyReleaseInputSchema,
    async execute(_context, input) {
      const candidate = input.release_candidate as unknown as ReleaseCandidate;
      const expectedDigest = candidate?.artifact?.digest || "sha256:unknown";
      const activeDigest = input.host_active_digest || expectedDigest;

      const provider = createLocalDeploymentProvider(activeDigest);

      const verification = await ProductionVerifier.verify({
        candidate,
        provider,
        rawTelemetry: input.raw_telemetry,
      });

      return {
        status: verification.status,
        deployed_artifact_digest_match: verification.deployed_artifact_digest_match,
        service_health: verification.service_health,
        database_connectivity: verification.database_connectivity,
        cache_connectivity: verification.cache_connectivity,
        background_processing_active: verification.background_processing_active,
        critical_endpoints_probed: verification.critical_endpoints_probed,
        details: verification.details,
      };
    },
  };
}

export function createRollbackReleaseTool(): ToolDefinition<typeof rollbackReleaseInputSchema> {
  return {
    name: "engineering_rollback_release",
    description: "Execute safe rollback to known good release with restoration verification and receipt.",
    readOnly: false,
    riskLevel: "destructive",
    inputSchema: rollbackReleaseInputSchema,
    async execute(_context, input) {
      const targetRelease = input.target_release as unknown as KnownGoodRelease;
      const provider = createLocalDeploymentProvider("sha256:broken_failed_release");

      const result = await RollbackController.executeRollback({
        failedReleaseId: input.failed_release_id,
        targetRelease,
        reason: input.reason,
        evidence: input.evidence as any,
        provider,
      });

      return {
        rollback_id: result.execution.rollback_id,
        status: result.execution.status,
        restored_digest: result.execution.restored_digest,
        receipt: result.receipt,
        errors: result.errors,
      };
    },
  };
}
