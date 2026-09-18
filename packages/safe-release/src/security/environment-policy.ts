import type { EnvironmentDefinition, EnvironmentType } from "../types.js";

export class EnvironmentRegistry {
  private static environments: Map<string, EnvironmentDefinition> = new Map([
    [
      "LOCAL",
      {
        environment_id: "LOCAL",
        product: "all",
        is_production: false,
        provider_name: "fake_provider",
        allowed_strategies: ["REPLACE"],
        requires_ci_pass: false,
        requires_explicit_approval: false,
        canary_required: false,
        auto_rollback_allowed: true
      }
    ],
    [
      "TEST",
      {
        environment_id: "TEST",
        product: "all",
        is_production: false,
        provider_name: "fake_provider",
        allowed_strategies: ["REPLACE"],
        requires_ci_pass: true,
        requires_explicit_approval: false,
        canary_required: false,
        auto_rollback_allowed: true
      }
    ],
    [
      "STAGING",
      {
        environment_id: "STAGING",
        product: "all",
        is_production: false,
        provider_name: "fake_provider",
        allowed_strategies: ["REPLACE", "ROLLING", "BLUE_GREEN"],
        requires_ci_pass: true,
        requires_explicit_approval: true,
        canary_required: false,
        auto_rollback_allowed: true
      }
    ],
    [
      "CANARY",
      {
        environment_id: "CANARY",
        product: "all",
        is_production: true,
        provider_name: "fake_provider",
        allowed_strategies: ["CANARY"],
        requires_ci_pass: true,
        requires_explicit_approval: true,
        canary_required: true,
        auto_rollback_allowed: false
      }
    ],
    [
      "PRODUCTION",
      {
        environment_id: "PRODUCTION",
        product: "all",
        is_production: true,
        provider_name: "fake_provider",
        allowed_strategies: ["CANARY", "ROLLING", "BLUE_GREEN"],
        requires_ci_pass: true,
        requires_explicit_approval: true,
        canary_required: true,
        auto_rollback_allowed: false
      }
    ]
  ]);

  public static get(environmentId: EnvironmentType): EnvironmentDefinition {
    const env = this.environments.get(environmentId);
    if (!env) {
      throw new Error(`UNKNOWN_ENVIRONMENT: Environment '${environmentId}' is not registered in EnvironmentRegistry.`);
    }
    return env;
  }

  public static registerCustom(definition: EnvironmentDefinition): void {
    this.environments.set(definition.environment_id, definition);
  }
}
