import type { ProductionVerification, ReleaseCandidate } from "../types.js";

export class InvariantVerifier {
  public static verifyReleaseInvariants(
    candidate: ReleaseCandidate,
    verification: ProductionVerification
  ): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    if (verification.status !== "PRODUCTION_VERIFIED") {
      violations.push(
        `INVARIANT_VIOLATION: Production verification status is '${verification.status}', expected 'PRODUCTION_VERIFIED'.`
      );
    }

    if (!verification.deployed_artifact_digest_match) {
      violations.push("INVARIANT_VIOLATION: ARTIFACT_DIGEST_MISMATCH — Active host artifact digest does not match release artifact.");
    }

    if (!verification.service_health) {
      violations.push("INVARIANT_VIOLATION: Service reported unhealthy during production verification.");
    }

    if (!verification.database_connectivity) {
      violations.push("INVARIANT_VIOLATION: Database connection failed during production verification.");
    }

    if (!verification.cache_connectivity) {
      violations.push("INVARIANT_VIOLATION: Cache connection failed during production verification.");
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
