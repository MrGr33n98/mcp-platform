import { DiffParser } from "../diff/diff-parser.js";
import { DiffClassifier } from "../diff/diff-classifier.js";
import type { DiffReport } from "../types.js";

export interface DiffValidationResult {
  valid: boolean;
  diffReport: DiffReport;
  errors: string[];
}

export class DiffValidator {
  public static validateDiff(
    rawDiff: string,
    declaredFiles: string[]
  ): DiffValidationResult {
    const errors: string[] = [];
    const parsed = DiffParser.parse(rawDiff);
    const diffReport = DiffClassifier.classifyDiff(parsed, declaredFiles, rawDiff);

    if (!diffReport.is_consistent_with_plan) {
      errors.push(
        `Diff contains unexpected or sensitive files: ${diffReport.unclassified_or_unexpected.join(", ")}`
      );
    }

    return {
      valid: errors.length === 0,
      diffReport,
      errors,
    };
  }
}
