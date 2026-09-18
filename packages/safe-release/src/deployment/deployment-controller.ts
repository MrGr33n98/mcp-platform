import type {
  DeploymentExecutionResult,
  DeploymentPlan,
  DeploymentProvider,
  EnvironmentType,
  ReleaseAuditEvent,
  ReleaseState
} from "../types.js";
import { DeploymentStateMachine } from "./deployment-state-machine.js";

export class ReleaseLock {
  private static activeLocks: Map<string, { releaseId: string; acquiredAt: number; ttlMs: number }> = new Map();

  public static acquire(product: string, environment: EnvironmentType, releaseId: string, ttlMs = 600000): boolean {
    const key = `${product}:${environment}`;
    const existing = this.activeLocks.get(key);
    const now = Date.now();

    if (existing && now < existing.acquiredAt + existing.ttlMs) {
      if (existing.releaseId === releaseId) {
        return true; // Reentrant
      }
      return false; // Conflito de concorrência
    }

    this.activeLocks.set(key, { releaseId, acquiredAt: now, ttlMs });
    return true;
  }

  public static release(product: string, environment: EnvironmentType, releaseId: string): void {
    const key = `${product}:${environment}`;
    const existing = this.activeLocks.get(key);
    if (existing && existing.releaseId === releaseId) {
      this.activeLocks.delete(key);
    }
  }

  public static isLocked(product: string, environment: EnvironmentType): boolean {
    const key = `${product}:${environment}`;
    const existing = this.activeLocks.get(key);
    if (!existing) return false;
    return Date.now() < existing.acquiredAt + existing.ttlMs;
  }

  public static resetAll(): void {
    this.activeLocks.clear();
  }
}

export class DeploymentReconciler {
  public static async reconcile(
    provider: DeploymentProvider,
    deploymentId: string,
    stateMachine: DeploymentStateMachine
  ): Promise<{ status: string; reconciledState: ReleaseState }> {
    const statusResult = await provider.status(deploymentId);

    let targetState: ReleaseState = "DEPLOY_FAILED";
    if (statusResult.status === "SUCCESS") {
      targetState = "CANARY_OBSERVING";
    } else if (statusResult.status === "IN_PROGRESS") {
      targetState = "CANARY_DEPLOYING";
    } else {
      targetState = "DEPLOY_FAILED";
    }

    try {
      if (stateMachine.canTransitionTo(targetState)) {
        stateMachine.transitionTo(targetState, `Reconciled from provider status '${statusResult.status}'.`);
      }
    } catch {
      // Keep state if not directly transitionable
    }

    return {
      status: statusResult.status,
      reconciledState: stateMachine.getCurrentState()
    };
  }
}
