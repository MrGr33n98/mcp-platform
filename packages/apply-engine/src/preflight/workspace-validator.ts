import fs from "fs";
import path from "path";

export class WorkspaceValidator {
  public static validate(workspaceRoot: string): { valid: boolean; reason?: string; resolvedRoot: string } {
    if (!workspaceRoot || typeof workspaceRoot !== "string") {
      return { valid: false, reason: "Workspace root must be a non-empty string.", resolvedRoot: "" };
    }

    const resolved = path.resolve(workspaceRoot);
    if (!fs.existsSync(resolved)) {
      return { valid: false, reason: `Workspace root directory does not exist: ${resolved}`, resolvedRoot: resolved };
    }

    try {
      const stats = fs.statSync(resolved);
      if (!stats.isDirectory()) {
        return { valid: false, reason: `Workspace root is not a directory: ${resolved}`, resolvedRoot: resolved };
      }
      fs.accessSync(resolved, fs.constants.R_OK | fs.constants.W_OK);
      return { valid: true, resolvedRoot: resolved };
    } catch (err: any) {
      return { valid: false, reason: `Workspace root is not readable/writable: ${err.message}`, resolvedRoot: resolved };
    }
  }
}
