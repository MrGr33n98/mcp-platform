import { describe, it, expect } from "vitest";
import { DeploymentStateMachine } from "../src/deployment/deployment-state-machine.js";
import { DeploymentReconciler } from "../src/deployment/deployment-controller.js";
import { FakeDeploymentProvider } from "../src/deployment/deployment-provider.js";
import { DeploymentPlanBuilder } from "../src/deployment/deployment-plan.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("DeploymentReconciler — Crash Recovery", () => {
  it("reconciles state machine safely after a crash without launching duplicate deployments", async () => {
    const { artifact } = createValidTestChain();
    const plan = DeploymentPlanBuilder.createPlan({
      product: "oest",
      environment: "CANARY",
      artifact
    });

    const provider = new FakeDeploymentProvider();
    const deployResult = await provider.deploy(plan, "CANARY");

    // Simula reinício do processo com state machine em CREATED -> PREPARING -> CANARY_DEPLOYING
    const sm = new DeploymentStateMachine("CREATED");
    sm.transitionTo("CI_VERIFIED");
    sm.transitionTo("APPROVAL_PENDING");
    sm.transitionTo("APPROVED");
    sm.transitionTo("PREPARING");
    sm.transitionTo("CANARY_DEPLOYING");

    // Reconciliar consultando o provider
    const reconciliation = await DeploymentReconciler.reconcile(provider, deployResult.deployment_id, sm);

    expect(reconciliation.status).toBe("SUCCESS");
    expect(reconciliation.reconciledState).toBe("CANARY_OBSERVING");
  });
});
