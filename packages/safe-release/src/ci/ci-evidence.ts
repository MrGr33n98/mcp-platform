import type { CIReceipt, CICheck } from "../types.js";

export interface CIEvidenceSummary {
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  skipped_checks: number;
  mandatory_passed: boolean;
  artifact_digests_count: number;
}

export class CIEvidence {
  public static summarize(receipt: CIReceipt): CIEvidenceSummary {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let mandatoryPassed = true;

    for (const check of receipt.checks) {
      if (check.status === "PASS") {
        passed++;
      } else if (check.status === "FAIL") {
        failed++;
        if (check.mandatory) {
          mandatoryPassed = false;
        }
      } else if (check.status === "SKIPPED") {
        skipped++;
        if (check.mandatory) {
          mandatoryPassed = false;
        }
      }
    }

    return {
      total_checks: receipt.checks.length,
      passed_checks: passed,
      failed_checks: failed,
      skipped_checks: skipped,
      mandatory_passed: mandatoryPassed,
      artifact_digests_count: receipt.artifact_digests.length
    };
  }
}
