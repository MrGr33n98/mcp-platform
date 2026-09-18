import type { GitClient } from "./git-client.js";
import { GitSecurityViolationError } from "../security/git-command-policy.js";

export class StagingManager {
  constructor(private readonly git: GitClient) {}

  public async stageDeclaredFiles(declaredFiles: string[]): Promise<string[]> {
    if (!declaredFiles || declaredFiles.length === 0) {
      throw new GitSecurityViolationError("Cannot stage: declared file list is empty.");
    }

    const sanitizedFiles: string[] = [];

    for (const file of declaredFiles) {
      const normalized = file.replace(/\\/g, "/").replace(/^\.\//, "").trim();
      if (!normalized) continue;

      if (normalized === "." || normalized === "*" || normalized.includes("*")) {
        throw new GitSecurityViolationError(`Illegal wildcard staging attempt detected: '${file}'`);
      }

      sanitizedFiles.push(normalized);
    }

    if (sanitizedFiles.length === 0) {
      throw new GitSecurityViolationError("No valid file paths found to stage.");
    }

    await this.git.addExplicitFiles(sanitizedFiles);
    return sanitizedFiles;
  }
}
