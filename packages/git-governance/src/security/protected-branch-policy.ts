import { GitSecurityViolationError } from "./git-command-policy.js";

export class ProtectedBranchPolicy {
  private static readonly DEFAULT_PROTECTED_BRANCHES = [
    "main",
    "master",
    "production",
    "prod",
    "staging",
  ];

  private static readonly PROTECTED_PREFIXES = [
    "release/",
    "hotfix-prod/",
  ];

  public static isProtected(branchName: string, customProtected: string[] = []): boolean {
    const normalized = branchName.trim().toLowerCase();
    
    if (this.DEFAULT_PROTECTED_BRANCHES.includes(normalized)) {
      return true;
    }

    for (const prefix of this.PROTECTED_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        return true;
      }
    }

    for (const custom of customProtected) {
      const customNorm = custom.trim().toLowerCase();
      if (normalized === customNorm || normalized.startsWith(customNorm.replace(/\*$/, ""))) {
        return true;
      }
    }

    return false;
  }

  public static assertNotProtected(branchName: string, customProtected: string[] = []): void {
    if (this.isProtected(branchName, customProtected)) {
      throw new GitSecurityViolationError(
        `Direct commit or push to protected branch '${branchName}' is strictly forbidden.`
      );
    }
  }

  public static generateIsolatedBranchName(capability: string, id: string): string {
    const cleanCap = capability
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/^-+|-+$/g, "");
    
    const cleanId = id
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 8);

    const branchName = `mcp/${cleanCap || "change"}/${cleanId || "branch"}`;
    this.validateBranchName(branchName);
    return branchName;
  }

  public static validateBranchName(branchName: string): void {
    const trimmed = branchName.trim();
    if (!trimmed) {
      throw new GitSecurityViolationError("Branch name cannot be empty.");
    }

    // Git ref name rules
    if (
      trimmed.startsWith("/") ||
      trimmed.endsWith("/") ||
      trimmed.startsWith(".") ||
      trimmed.endsWith(".") ||
      trimmed.includes("..") ||
      trimmed.includes("~") ||
      trimmed.includes("^") ||
      trimmed.includes(":") ||
      trimmed.includes("?") ||
      trimmed.includes("*") ||
      trimmed.includes("[") ||
      trimmed.includes("@{") ||
      trimmed.includes("\\") ||
      trimmed.includes(" ")
    ) {
      throw new GitSecurityViolationError(`Invalid git branch name format: '${branchName}'`);
    }
  }
}
