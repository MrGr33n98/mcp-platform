import { ProtectedBranchPolicy } from "../security/protected-branch-policy.js";

export interface BranchValidationResult {
  valid: boolean;
  errors: string[];
}

export class BranchValidator {
  public static validate(
    targetBranch: string,
    isDirectCommitAllowed: boolean = false
  ): BranchValidationResult {
    const errors: string[] = [];

    if (!isDirectCommitAllowed && ProtectedBranchPolicy.isProtected(targetBranch)) {
      errors.push(`Target branch '${targetBranch}' is protected. Direct commits are forbidden.`);
    }

    try {
      ProtectedBranchPolicy.validateBranchName(targetBranch);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
