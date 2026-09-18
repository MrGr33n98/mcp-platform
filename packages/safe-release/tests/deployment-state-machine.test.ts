import { describe, it, expect } from "vitest";
import { DeploymentStateMachine } from "../src/deployment/deployment-state-machine.js";

describe("DeploymentStateMachine", () => {
  it("allows valid transitions through the release lifecycle", () => {
    const sm = new DeploymentStateMachine("CREATED");
    expect(sm.getCurrentState()).toBe("CREATED");

    sm.transitionTo("CI_VERIFIED");
    sm.transitionTo("APPROVAL_PENDING");
    sm.transitionTo("APPROVED");
    sm.transitionTo("PREPARING");
    sm.transitionTo("CANARY_DEPLOYING");
    sm.transitionTo("CANARY_OBSERVING");
    sm.transitionTo("CANARY_HEALTHY");
    sm.transitionTo("PROMOTION_PENDING");
    sm.transitionTo("PROMOTING");
    sm.transitionTo("PRODUCTION_DEPLOYED");
    sm.transitionTo("PRODUCTION_VERIFYING");
    sm.transitionTo("PRODUCTION_VERIFIED");

    expect(sm.getCurrentState()).toBe("PRODUCTION_VERIFIED");
  });

  it("blocks illegal state transitions", () => {
    const sm = new DeploymentStateMachine("CREATED");
    expect(() => sm.transitionTo("PRODUCTION_VERIFIED")).toThrowError("INVALID_STATE_TRANSITION");
    expect(() => sm.transitionTo("PROMOTING")).toThrowError("INVALID_STATE_TRANSITION");
  });

  it("handles failure transitions and rollback paths", () => {
    const sm = new DeploymentStateMachine("CANARY_OBSERVING");
    sm.transitionTo("CANARY_FAILED");
    sm.transitionTo("ROLLBACK_REQUIRED");
    sm.transitionTo("ROLLING_BACK");
    sm.transitionTo("ROLLED_BACK");
    expect(sm.getCurrentState()).toBe("ROLLED_BACK");
  });
});
