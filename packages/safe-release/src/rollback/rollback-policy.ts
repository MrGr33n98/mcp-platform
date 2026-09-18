import type { EnvironmentType, KnownGoodRelease } from "../types.js";
import { EnvironmentRegistry } from "../security/environment-policy.js";

export class RollbackPolicy {
  public static isRollbackAllowed(environment: EnvironmentType, isAutomaticTrigger: boolean): { allowed: boolean; reason?: string | undefined } {
    const envDef = EnvironmentRegistry.get(environment);

    if (isAutomaticTrigger && !envDef.auto_rollback_allowed) {
      return {
        allowed: false,
        reason: `AUTOMATIC_ROLLBACK_DISABLED: Environment '${environment}' requires explicit human approval for rollback actions.`
      };
    }

    return { allowed: true };
  }

  public static validateKnownGoodRelease(target: KnownGoodRelease): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!target.release_id || target.release_id.trim().length === 0) {
      errors.push("INVALID_ROLLBACK_TARGET: KnownGoodRelease release_id is empty.");
    }

    if (!target.artifact_digest || !target.artifact_digest.startsWith("sha256:")) {
      errors.push(`INVALID_ROLLBACK_TARGET: KnownGoodRelease artifact digest '${target.artifact_digest}' is invalid.`);
    }

    if (!target.provenance_verified) {
      errors.push("UNVERIFIED_ROLLBACK_TARGET: Target release does not have verified provenance.");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
