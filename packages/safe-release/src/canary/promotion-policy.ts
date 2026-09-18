import type { HealthEvaluation } from "../types.js";

export interface PromotionEvaluation {
  can_promote: boolean;
  verdict: "ALLOW_PROMOTION" | "BLOCK_PROMOTION";
  reasons: string[];
}

export class PromotionPolicy {
  public static evaluate(health: HealthEvaluation): PromotionEvaluation {
    const reasons: string[] = [];

    if (health.status === "INSUFFICIENT_EVIDENCE") {
      reasons.push(
        "BLOCK_PROMOTION: Cannot promote canary release due to INSUFFICIENT_EVIDENCE. Absence of telemetric errors does NOT equal a healthy system."
      );
      reasons.push(...health.rationale);
      return {
        can_promote: false,
        verdict: "BLOCK_PROMOTION",
        reasons
      };
    }

    if (health.status === "UNHEALTHY") {
      reasons.push(
        "BLOCK_PROMOTION: Canary is UNHEALTHY. Health thresholds were violated during the observation window."
      );
      reasons.push(...health.rationale);
      return {
        can_promote: false,
        verdict: "BLOCK_PROMOTION",
        reasons
      };
    }

    if (health.status === "DEGRADED") {
      reasons.push(
        "BLOCK_PROMOTION: Canary is DEGRADED (insufficient sample size or minor warnings). Manual intervention required."
      );
      reasons.push(...health.rationale);
      return {
        can_promote: false,
        verdict: "BLOCK_PROMOTION",
        reasons
      };
    }

    return {
      can_promote: true,
      verdict: "ALLOW_PROMOTION",
      reasons: ["Canary observation completed successfully with HEALTHY signals."]
    };
  }
}
