import type { CanaryPolicy } from "../types.js";

export class DefaultCanaryPolicy {
  public static get(): CanaryPolicy {
    return {
      traffic_percentage: 10,
      instance_count: 1,
      observation_window_seconds: 60,
      minimum_requests: 50,
      health_thresholds: {
        max_http_5xx_rate: 0.01, // 1%
        max_latency_p95_ms: 1000,
        max_error_count: 5
      },
      error_budget: {
        allowed_5xx_count: 2,
        budget_exhaustion_action: "BLOCK_PROMOTION"
      }
    };
  }
}
