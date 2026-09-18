import type { ConfidenceLevel } from "../types.js";

export class ConfidenceEngine {
  public static calculateConfidence(
    supportingCount: number,
    contradictingCount: number,
    isDirectMatch: boolean
  ): ConfidenceLevel {
    if (contradictingCount > 0) {
      return "LOW";
    }

    if (isDirectMatch && supportingCount >= 2) {
      return "HIGH";
    }

    if (supportingCount >= 1) {
      return "MEDIUM";
    }

    return "LOW";
  }
}
