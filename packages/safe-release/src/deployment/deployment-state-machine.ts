import type { ReleaseState } from "../types.js";

const VALID_TRANSITIONS: Record<ReleaseState, ReleaseState[]> = {
  CREATED: ["CI_VERIFIED", "CI_FAILED"],
  CI_VERIFIED: ["APPROVAL_PENDING", "CI_FAILED"],
  CI_FAILED: [],
  APPROVAL_PENDING: ["APPROVED", "PROMOTION_BLOCKED"],
  APPROVED: ["PREPARING", "PROMOTION_BLOCKED"],
  PREPARING: ["CANARY_DEPLOYING", "PRODUCTION_DEPLOYED", "DEPLOY_FAILED"],
  CANARY_DEPLOYING: ["CANARY_OBSERVING", "DEPLOY_FAILED"],
  CANARY_OBSERVING: ["CANARY_HEALTHY", "CANARY_FAILED"],
  CANARY_HEALTHY: ["PROMOTION_PENDING", "CANARY_FAILED"],
  CANARY_FAILED: ["ROLLBACK_REQUIRED", "PROMOTION_BLOCKED"],
  PROMOTION_PENDING: ["PROMOTING", "PROMOTION_BLOCKED"],
  PROMOTION_BLOCKED: ["ROLLBACK_REQUIRED"],
  PROMOTING: ["PRODUCTION_DEPLOYED", "DEPLOY_FAILED"],
  DEPLOY_FAILED: ["ROLLBACK_REQUIRED"],
  PRODUCTION_DEPLOYED: ["PRODUCTION_VERIFYING", "DEPLOY_FAILED", "PRODUCTION_UNHEALTHY"],
  PRODUCTION_VERIFYING: ["PRODUCTION_VERIFIED", "PRODUCTION_UNHEALTHY"],
  PRODUCTION_VERIFIED: [],
  PRODUCTION_UNHEALTHY: ["ROLLBACK_REQUIRED"],
  ROLLBACK_REQUIRED: ["ROLLING_BACK", "ROLLBACK_FAILED"],
  ROLLING_BACK: ["ROLLED_BACK", "ROLLBACK_FAILED"],
  ROLLED_BACK: [],
  ROLLBACK_FAILED: []
};

export class DeploymentStateMachine {
  private state: ReleaseState;

  constructor(initialState: ReleaseState = "CREATED") {
    this.state = initialState;
  }

  public getCurrentState(): ReleaseState {
    return this.state;
  }

  public canTransitionTo(targetState: ReleaseState): boolean {
    const allowed = VALID_TRANSITIONS[this.state] ?? [];
    return allowed.includes(targetState);
  }

  public transitionTo(targetState: ReleaseState, reason?: string): ReleaseState {
    if (!this.canTransitionTo(targetState)) {
      throw new Error(
        `INVALID_STATE_TRANSITION: Cannot transition from '${this.state}' to '${targetState}'. ${
          reason ? `Reason: ${reason}` : ""
        }`
      );
    }
    this.state = targetState;
    return this.state;
  }
}
