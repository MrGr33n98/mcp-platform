import type { GitClient } from "../git/git-client.js";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";

export interface RepoValidationResult {
  valid: boolean;
  currentBranch: string;
  currentCommit: string;
  errors: string[];
}

export class RepositoryValidator {
  public static async validate(
    git: GitClient,
    applyReceipt: ApplyReceipt,
    declaredFiles: string[],
    allowDirtyTreeForTest: boolean = false
  ): Promise<RepoValidationResult> {
    const errors: string[] = [];

    let currentBranch = "";
    let currentCommit = "";

    try {
      currentBranch = await git.getCurrentBranch();
      currentCommit = await git.getHeadCommit();
    } catch (err) {
      errors.push(`Failed to query repository state: ${err instanceof Error ? err.message : String(err)}`);
      return { valid: false, currentBranch: "", currentCommit: "", errors };
    }

    // Revision check
    const expectedSha =
      applyReceipt.repository_after?.commitSha ||
      applyReceipt.repository_before.commitSha;

    if (expectedSha && currentCommit && !currentCommit.startsWith(expectedSha) && !expectedSha.startsWith(currentCommit)) {
      // In local apply, commit before and after might match initial state because apply-engine does not commit
      if (currentCommit !== applyReceipt.repository_before.commitSha) {
        errors.push(
          `Repository commit changed since ApplyReceipt: current '${currentCommit}' vs expected '${expectedSha}'`
        );
      }
    }

    // Working tree status check
    if (!allowDirtyTreeForTest) {
      const statusOutput = await git.getStatus();
      const statusLines = statusOutput.split(/\r?\n/).filter(l => l.trim().length > 0);

      const normalizedDeclared = new Set(
        declaredFiles.map(f => f.replace(/\\/g, "/").replace(/^\.\//, "").trim())
      );

      for (const line of statusLines) {
        const filePath = line.substring(3).trim().replace(/\\/g, "/");
        // Skip lock files or snapshot directories if any
        if (filePath.startsWith(".git") || filePath.startsWith(".apply_") || filePath.startsWith(".git_gov_")) {
          continue;
        }

        const isDeclared =
          normalizedDeclared.has(filePath) ||
          Array.from(normalizedDeclared).some(d => d.startsWith(filePath) || filePath.startsWith(d));

        if (!isDeclared) {
          errors.push(`Unrelated dirty file in working tree before git operation: '${filePath}'`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      currentBranch,
      currentCommit,
      errors,
    };
  }
}
