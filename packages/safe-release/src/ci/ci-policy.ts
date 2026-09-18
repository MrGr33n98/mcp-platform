import type { CIReceipt } from "../types.js";
import { CIEvidence } from "./ci-evidence.js";

export interface CIPolicyEvaluation {
  allowed: boolean;
  violations: string[];
}

export class CIPolicy {
  public static evaluate(
    receipt: CIReceipt,
    options?: { maxAgeHours?: number | undefined }
  ): CIPolicyEvaluation {
    const violations: string[] = [];

    // 1. Status Geral do CI
    if (receipt.status !== "PASS") {
      violations.push(
        `CI_STATUS_NOT_PASS: CI run status is '${receipt.status}'. Releases require a full 'PASS'.`
      );
    }

    // 2. Checks Mandatórios e Skipped
    if (!receipt.checks || receipt.checks.length === 0) {
      violations.push("NO_CHECKS_EXECUTED: CI run contains zero test or verification checks.");
    } else {
      const summary = CIEvidence.summarize(receipt);
      if (!summary.mandatory_passed) {
        violations.push(
          `MANDATORY_CHECKS_FAILED_OR_SKIPPED: One or more mandatory CI checks did not pass.`
        );
      }
      for (const check of receipt.checks) {
        if (check.mandatory && check.status === "SKIPPED") {
          violations.push(
            `CRITICAL_CHECK_SKIPPED: Mandatory check '${check.name}' was skipped.`
          );
        }
        if (check.mandatory && check.status === "FAIL") {
          violations.push(
            `CRITICAL_CHECK_FAILED: Mandatory check '${check.name}' failed.`
          );
        }
      }
    }

    // 3. Artefato produzido pelo CI
    if (!receipt.artifact_digests || receipt.artifact_digests.length === 0) {
      violations.push("NO_ARTIFACT_DIGEST: CI receipt did not register any built artifact digest.");
    }

    // 4. Stale CI Check (TTL)
    const maxAgeHours = options?.maxAgeHours ?? 24;
    const finishedTime = new Date(receipt.finished_at).getTime();
    if (isNaN(finishedTime)) {
      violations.push("INVALID_CI_TIMESTAMP: CI finished_at timestamp is invalid.");
    } else {
      const ageHours = (Date.now() - finishedTime) / (1000 * 60 * 60);
      if (ageHours > maxAgeHours) {
        violations.push(
          `STALE_CI_RUN: CI run is ${ageHours.toFixed(1)} hours old (max allowed: ${maxAgeHours} hours). Re-run CI required.`
        );
      }
    }

    return {
      allowed: violations.length === 0,
      violations
    };
  }
}
