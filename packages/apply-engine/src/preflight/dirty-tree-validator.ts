import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";

export class DirtyTreeValidator {
  public static validate(workspaceRoot: string, allowDirty: boolean = false): { isClean: boolean; reason?: string; modifiedFiles: string[] } {
    if (allowDirty) {
      return { isClean: true, modifiedFiles: [] };
    }

    const gitDir = path.join(workspaceRoot, ".git");
    if (!fs.existsSync(gitDir)) {
      // Not a git repository (e.g. standalone test sandbox), clean by default
      return { isClean: true, modifiedFiles: [] };
    }

    try {
      const output = execFileSync("git", ["status", "--porcelain"], {
        cwd: workspaceRoot,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"]
      });

      const lines = output
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 0);

      if (lines.length > 0) {
        const files = lines.map((l: string) => l.substring(3).trim());
        return {
          isClean: false,
          reason: `DIRTY WORKTREE DETECTED (${lines.length} uncommitted changes). Apply Engine will NOT overwrite or discard human uncommitted work. Commit or stash changes first.`,
          modifiedFiles: files
        };
      }

      return { isClean: true, modifiedFiles: [] };
    } catch (err: any) {
      // In case git fails, proceed conservatively or return clean if git unavailable
      return { isClean: true, modifiedFiles: [] };
    }
  }
}
