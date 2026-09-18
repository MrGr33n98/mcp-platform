import type {
  DeploymentExecutionResult,
  DeploymentPlan,
  DeploymentProvider,
  DeploymentStrategyType,
  DeploymentTarget,
  RollbackExecutionResult,
  RollbackPlan
} from "../types.js";

export interface FakeDeploymentProviderOptions {
  name?: string | undefined;
  capabilities?: DeploymentStrategyType[] | undefined;
  failPrepare?: boolean | undefined;
  failDeploy?: boolean | undefined;
  failRollback?: boolean | undefined;
  simulateTimeout?: boolean | undefined;
  simulateCrash?: boolean | undefined;
  mismatchDeployedArtifact?: string | undefined;
}

export class FakeDeploymentProvider implements DeploymentProvider {
  public name: string;
  public capabilities: DeploymentStrategyType[];
  private activeArtifactDigest: string = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
  private currentStatus: "READY" | "DEPLOYING" | "RUNNING" | "FAILED" = "READY";
  private deploymentHistory: Map<string, { plan: DeploymentPlan; scope: string; status: "SUCCESS" | "FAILED" | "IN_PROGRESS" | "TIMEOUT"; digest: string }> = new Map();
  private options: FakeDeploymentProviderOptions;

  constructor(options?: FakeDeploymentProviderOptions) {
    this.options = options ?? {};
    this.name = this.options.name ?? "FakeDeploymentProvider";
    this.capabilities = this.options.capabilities ?? ["REPLACE", "ROLLING", "BLUE_GREEN", "CANARY"];
  }

  public setActiveDigest(digest: string): void {
    this.activeArtifactDigest = digest;
  }

  public async inspect(target: DeploymentTarget): Promise<{ active_digest: string; status: string }> {
    return {
      active_digest: this.activeArtifactDigest,
      status: this.currentStatus
    };
  }

  public async prepare(plan: DeploymentPlan): Promise<{ ready: boolean; error?: string | undefined }> {
    if (this.options.failPrepare) {
      return { ready: false, error: "SIMULATED_PREPARATION_FAILURE: Failed to pull image or prepare environment." };
    }
    return { ready: true };
  }

  public async deploy(
    plan: DeploymentPlan,
    scope: "CANARY" | "FULL"
  ): Promise<DeploymentExecutionResult> {
    const deploymentId = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    if (this.options.simulateTimeout) {
      this.deploymentHistory.set(deploymentId, {
        plan,
        scope,
        status: "TIMEOUT",
        digest: this.activeArtifactDigest
      });
      return {
        deployment_id: deploymentId,
        status: "TIMEOUT",
        active_artifact_digest: this.activeArtifactDigest,
        message: "Provider operation timed out."
      };
    }

    if (this.options.simulateCrash) {
      this.currentStatus = "DEPLOYING";
      this.deploymentHistory.set(deploymentId, {
        plan,
        scope,
        status: "IN_PROGRESS",
        digest: this.activeArtifactDigest
      });
      throw new Error("SIMULATED_CRASH: Process crashed during deployment.");
    }

    if (this.options.failDeploy) {
      this.currentStatus = "FAILED";
      this.deploymentHistory.set(deploymentId, {
        plan,
        scope,
        status: "FAILED",
        digest: this.activeArtifactDigest
      });
      return {
        deployment_id: deploymentId,
        status: "FAILED",
        active_artifact_digest: this.activeArtifactDigest,
        message: "Simulated deployment mutation failed on target host."
      };
    }

    const deployedDigest = this.options.mismatchDeployedArtifact ?? plan.artifact.digest;
    this.activeArtifactDigest = deployedDigest;
    this.currentStatus = "RUNNING";

    this.deploymentHistory.set(deploymentId, {
      plan,
      scope,
      status: "SUCCESS",
      digest: deployedDigest
    });

    return {
      deployment_id: deploymentId,
      status: "SUCCESS",
      active_artifact_digest: deployedDigest,
      message: `Successfully applied ${scope} deployment with artifact ${deployedDigest}.`
    };
  }

  public async status(deploymentId: string): Promise<DeploymentExecutionResult> {
    const record = this.deploymentHistory.get(deploymentId);
    if (!record) {
      return {
        deployment_id: deploymentId,
        status: "FAILED",
        active_artifact_digest: this.activeArtifactDigest,
        message: "Deployment ID not found."
      };
    }
    return {
      deployment_id: deploymentId,
      status: record.status,
      active_artifact_digest: record.digest
    };
  }

  public async rollback(plan: RollbackPlan): Promise<RollbackExecutionResult> {
    const rollbackId = `rbk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    if (this.options.failRollback) {
      return {
        rollback_id: rollbackId,
        status: "FAILED",
        restored_digest: this.activeArtifactDigest,
        message: "Simulated rollback execution failure."
      };
    }

    this.activeArtifactDigest = plan.target_release.artifact_digest;
    this.currentStatus = "RUNNING";

    return {
      rollback_id: rollbackId,
      status: "SUCCESS",
      restored_digest: this.activeArtifactDigest,
      message: `Restored target release ${plan.target_release.release_id} with digest ${this.activeArtifactDigest}.`
    };
  }
}
