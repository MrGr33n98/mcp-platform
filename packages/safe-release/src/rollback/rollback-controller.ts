import { createHash } from "node:crypto";
import type {
  DeploymentProvider,
  Evidence,
  KnownGoodRelease,
  RollbackExecutionResult,
  RollbackPlan,
  RollbackReceipt
} from "../types.js";
import { RollbackPolicy } from "./rollback-policy.js";
import { RollbackVerifier } from "./rollback-verifier.js";

export class RollbackController {
  public static async executeRollback(params: {
    failedReleaseId: string;
    targetRelease: KnownGoodRelease;
    reason: string;
    evidence?: Evidence[] | undefined;
    provider: DeploymentProvider;
    diagnosticsBeforeDigest?: string | undefined;
  }): Promise<{
    receipt?: RollbackReceipt | undefined;
    execution: RollbackExecutionResult;
    errors: string[];
  }> {
    const {
      failedReleaseId,
      targetRelease,
      reason,
      evidence = [],
      provider,
      diagnosticsBeforeDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    } = params;

    // 1. Validar Known Good Release
    const targetValidation = RollbackPolicy.validateKnownGoodRelease(targetRelease);
    if (!targetValidation.valid) {
      return {
        execution: {
          rollback_id: `rbk_failed_${Date.now()}`,
          status: "FAILED",
          restored_digest: "none",
          message: "Target release validation failed."
        },
        errors: targetValidation.errors
      };
    }

    // 2. Construir Plano de Rollback
    const rollbackId = `rbk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const plan: RollbackPlan = {
      rollback_id: rollbackId,
      failed_release_id: failedReleaseId,
      target_release: targetRelease,
      reason,
      evidence,
      expected_state: targetRelease.artifact_digest,
      verification_plan: [
        "VERIFY_RESTORED_DIGEST",
        "VERIFY_HEALTH_ENDPOINT",
        "VERIFY_DATABASE_CONNECTIVITY"
      ]
    };

    // 3. Executar Rollback no Provider
    const executionResult = await provider.rollback(plan);
    if (executionResult.status !== "SUCCESS") {
      return {
        execution: executionResult,
        errors: [executionResult.message ?? "Rollback provider execution failed."]
      };
    }

    // 4. Verificar Restauração
    const verifyResult = await RollbackVerifier.verifyRestoration({
      provider,
      targetRelease
    });

    const timestamp = new Date().toISOString();
    const diagnosticsAfterDigest = `sha256:${createHash("sha256")
      .update(timestamp + verifyResult.activeDigest)
      .digest("hex")}`;

    const receiptDigest = createHash("sha256")
      .update(
        JSON.stringify({
          rollbackId,
          failedReleaseId,
          targetReleaseId: targetRelease.release_id,
          restoredDigest: verifyResult.activeDigest,
          timestamp,
          status: verifyResult.verified ? "ROLLBACK_VERIFIED" : "ROLLBACK_FAILED"
        })
      )
      .digest("hex");

    const receipt: RollbackReceipt = {
      schema_version: 1,
      receipt_type: "ROLLBACK_RECEIPT",
      rollback_id: rollbackId,
      failed_release_id: failedReleaseId,
      restored_release_id: targetRelease.release_id,
      restored_artifact_digest: verifyResult.activeDigest,
      reason,
      diagnostics_before: diagnosticsBeforeDigest,
      diagnostics_after: diagnosticsAfterDigest,
      verification_status: verifyResult.verified ? "ROLLBACK_VERIFIED" : "ROLLBACK_FAILED",
      timestamp,
      receipt_digest: `sha256:${receiptDigest}`
    };

    return {
      receipt,
      execution: executionResult,
      errors: verifyResult.verified ? [] : [verifyResult.error ?? "Restoration verification failed."]
    };
  }
}
