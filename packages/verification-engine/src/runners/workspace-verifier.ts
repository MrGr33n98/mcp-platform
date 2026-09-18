import { execSync } from "child_process";
import type { RepositoryRevision } from "../types.js";

export class WorkspaceVerifier {
  public static captureRevision(workspaceRoot: string): RepositoryRevision {
    try {
      const commitSha = execSync("git rev-parse HEAD", {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8"
      }).trim();

      const branch = execSync("git branch --show-current", {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8"
      }).trim() || "main";

      const statusOutput = execSync("git status --porcelain", {
        cwd: workspaceRoot,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf-8"
      }).trim();

      return {
        commitSha,
        branch,
        dirty: statusOutput.length > 0,
        capturedAt: new Date().toISOString()
      };
    } catch {
      return {
        commitSha: "UNKNOWN_UNVERSIONED",
        branch: "unknown",
        dirty: false,
        capturedAt: new Date().toISOString()
      };
    }
  }
}
