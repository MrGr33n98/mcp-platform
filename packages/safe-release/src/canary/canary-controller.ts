import type {
  CanaryPolicy,
  DeploymentPlan,
  DeploymentProvider,
  HealthEvaluation
} from "../types.js";
import type { Observation } from "@mcp-platform/production-diagnostics";
import { HealthEvaluator } from "./health-evaluator.js";
import { PromotionPolicy, type PromotionEvaluation } from "./promotion-policy.js";
import { DefaultCanaryPolicy } from "./canary-policy.js";

export class CanaryController {
  private provider: DeploymentProvider;
  private policy: CanaryPolicy;

  constructor(provider: DeploymentProvider, policy?: Partial<CanaryPolicy>) {
    this.provider = provider;
    this.policy = { ...DefaultCanaryPolicy.get(), ...(policy ?? {}) };
  }

  public async executeCanary(params: {
    plan: DeploymentPlan;
    rawTelemetry?: {
      total_requests?: number | undefined;
      error_5xx_count?: number | undefined;
      p95_latency_ms?: number | undefined;
      observations?: Observation[] | undefined;
    } | undefined;
  }): Promise<{
    deployment_id: string;
    health: HealthEvaluation;
    promotion: PromotionEvaluation;
  }> {
    const deployResult = await this.provider.deploy(params.plan, "CANARY");

    if (deployResult.status !== "SUCCESS") {
      const health: HealthEvaluation = {
        status: "UNHEALTHY",
        signals_evaluated: {
          deployment: { available: true, status: "FAIL" }
        },
        rationale: [deployResult.message ?? "Canary deployment execution failed."]
      };
      return {
        deployment_id: deployResult.deployment_id,
        health,
        promotion: PromotionPolicy.evaluate(health)
      };
    }

    // Avaliar a saúde durante a janela
    const health = HealthEvaluator.evaluate({
      policy: this.policy,
      telemetry: params.rawTelemetry
    });

    const promotion = PromotionPolicy.evaluate(health);

    return {
      deployment_id: deployResult.deployment_id,
      health,
      promotion
    };
  }
}
