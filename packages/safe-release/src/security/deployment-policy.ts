import type { DeploymentPlan, DeploymentProvider, EnvironmentType } from "../types.js";
import { EnvironmentRegistry } from "./environment-policy.js";

const FORBIDDEN_RAW_COMMAND_PATTERNS = [
  /ssh\s+/i,
  /docker\s+run/i,
  /docker\s+exec/i,
  /kubectl\s+apply/i,
  /kubectl\s+exec/i,
  /bash\s+-c/i,
  /sh\s+-c/i,
  /eval\s+/i,
  /curl\s+.*\s*\|\s*sh/i
];

export class DeploymentPolicy {
  public static validatePlanSafety(
    plan: DeploymentPlan,
    provider: DeploymentProvider,
    environment: EnvironmentType
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const envDef = EnvironmentRegistry.get(environment);

    // 1. Proibição de Raw Shell Commands
    for (const step of plan.steps) {
      for (const pattern of FORBIDDEN_RAW_COMMAND_PATTERNS) {
        if (pattern.test(step.action_type) || pattern.test(step.name)) {
          errors.push(
            `RAW_SHELL_COMMAND_FORBIDDEN: Step '${step.name}' contains forbidden arbitrary shell pattern '${pattern.source}'. Deployment must use typed DeploymentProvider APIs.`
          );
        }
      }
    }

    // 2. Validação de Estratégia de Deploy suportada pelo Provider e Ambiente
    if (!provider.capabilities.includes(plan.strategy)) {
      errors.push(
        `UNSUPPORTED_STRATEGY: Provider '${provider.name}' does not support strategy '${plan.strategy}'. Supported: [${provider.capabilities.join(", ")}].`
      );
    }
    if (!envDef.allowed_strategies.includes(plan.strategy)) {
      errors.push(
        `STRATEGY_NOT_ALLOWED_FOR_ENVIRONMENT: Strategy '${plan.strategy}' is not allowed in environment '${environment}'. Allowed: [${envDef.allowed_strategies.join(", ")}].`
      );
    }

    // 3. Exigência de Canary em Produção se configurado
    if (envDef.canary_required && plan.strategy !== "CANARY") {
      errors.push(
        `CANARY_REQUIRED: Environment '${environment}' requires strategy 'CANARY', but '${plan.strategy}' was specified.`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
