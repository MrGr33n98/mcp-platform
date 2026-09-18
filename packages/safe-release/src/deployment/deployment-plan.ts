import type {
  DeploymentPlan,
  DeploymentStrategyType,
  DeploymentTarget,
  ReleaseArtifact
} from "../types.js";

export class DeploymentPlanBuilder {
  public static createPlan(params: {
    product: string;
    environment: DeploymentTarget["environment"];
    service?: string | undefined;
    artifact: ReleaseArtifact;
    strategy?: DeploymentStrategyType | undefined;
    timeoutMs?: number | undefined;
  }): DeploymentPlan {
    const {
      product,
      environment,
      service = "web",
      artifact,
      strategy = (environment === "PRODUCTION" || environment === "CANARY") ? "CANARY" : "REPLACE",
      timeoutMs = 300000
    } = params;

    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    return {
      plan_id: planId,
      target: {
        product,
        environment,
        service
      },
      artifact: {
        digest: artifact.digest,
        immutable_tag: artifact.immutable_tag
      },
      strategy,
      steps: [
        {
          step_id: "step_preflight",
          name: "Verify Target & Snapshot Diagnostics",
          action_type: "PREFLIGHT",
          timeout_ms: 30000
        },
        {
          step_id: "step_deploy",
          name: "Apply Artifact Mutation",
          action_type: "DEPLOY",
          timeout_ms: 120000
        },
        {
          step_id: "step_verify",
          name: "Verify Production Invariants",
          action_type: "VERIFY",
          timeout_ms: 60000
        }
      ],
      preconditions: [
        "CI_PASS",
        "PROVENANCE_VERIFIED",
        "HEALTHY_BASELINE_DIAGNOSTICS"
      ],
      health_checks: [
        "HTTP_200_HEALTH_ENDPOINT",
        "DATABASE_CONNECTIVITY",
        "ERROR_RATE_BELOW_THRESHOLD"
      ],
      promotion_criteria: [
        {
          metric: "http_5xx_rate",
          operator: "<=",
          threshold: 0.01,
          window_seconds: 60
        },
        {
          metric: "p95_latency_ms",
          operator: "<=",
          threshold: 1000,
          window_seconds: 60
        }
      ],
      rollback_criteria: [
        {
          metric: "http_5xx_rate",
          operator: ">=",
          threshold: 0.05
        }
      ],
      timeout_ms: timeoutMs
    };
  }
}
