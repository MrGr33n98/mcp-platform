import path from "path";
import fs from "fs";

export class PathPolicy {
  public static normalizePath(p: string): string {
    return p.replace(/\\/g, "/");
  }

  public static isContained(workspaceRoot: string, targetPath: string): boolean {
    const normWorkspace = this.normalizePath(path.resolve(workspaceRoot));
    const normTarget = this.normalizePath(path.resolve(workspaceRoot, targetPath));

    // Handle case insensitivity on Windows
    if (process.platform === "win32") {
      return normTarget.toLowerCase().startsWith(normWorkspace.toLowerCase() + "/") ||
             normTarget.toLowerCase() === normWorkspace.toLowerCase();
    }

    return normTarget.startsWith(normWorkspace + "/") || normTarget === normWorkspace;
  }

  public static validatePath(workspaceRoot: string, relativePath: string): { valid: boolean; reason?: string; absolutePath: string } {
    if (!relativePath || typeof relativePath !== "string") {
      return { valid: false, reason: "Path must be a non-empty string.", absolutePath: "" };
    }

    // 1. Block explicit traversal tricks
    const norm = this.normalizePath(relativePath);
    if (norm.startsWith("/") || /^[a-zA-Z]:/.test(norm) || norm.startsWith("//") || norm.startsWith("\\\\")) {
      return { valid: false, reason: "Path must be relative to workspace root.", absolutePath: "" };
    }

    if (norm.split("/").includes("..")) {
      return { valid: false, reason: "Path traversal ('..') is strictly prohibited.", absolutePath: "" };
    }

    const absolute = path.resolve(workspaceRoot, relativePath);
    if (!this.isContained(workspaceRoot, absolute)) {
      return { valid: false, reason: "Resolved path escapes workspace boundary.", absolutePath: absolute };
    }

    // 2. Realpath check if target exists
    if (fs.existsSync(absolute)) {
      try {
        const real = fs.realpathSync(absolute);
        if (!this.isContained(workspaceRoot, real)) {
          return { valid: false, reason: "Realpath symlink/junction escapes workspace boundary.", absolutePath: absolute };
        }
      } catch (err: any) {
        return { valid: false, reason: `Failed to resolve realpath: ${err.message}`, absolutePath: absolute };
      }
    } else {
      // Check closest existing ancestor inside workspace
      let current = path.dirname(absolute);
      while (current && this.isContained(workspaceRoot, current)) {
        if (fs.existsSync(current)) {
          try {
            const realAncestor = fs.realpathSync(current);
            if (!this.isContained(workspaceRoot, realAncestor)) {
              return { valid: false, reason: "Ancestor symlink/junction escapes workspace boundary.", absolutePath: absolute };
            }
          } catch {
            // Ignore error
          }
          break;
        }
        if (this.normalizePath(current).toLowerCase() === this.normalizePath(workspaceRoot).toLowerCase()) {
          break;
        }
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
      }
    }

    return { valid: true, absolutePath: absolute };
  }
}
