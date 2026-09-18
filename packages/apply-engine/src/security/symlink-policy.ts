import fs from "fs";
import { PathPolicy } from "./path-policy.js";

export class SymlinkPolicy {
  public static isSafeSymlink(workspaceRoot: string, targetPath: string): { safe: boolean; reason?: string } {
    if (!fs.existsSync(targetPath)) {
      return { safe: true };
    }

    try {
      const lstat = fs.lstatSync(targetPath);
      if (lstat.isSymbolicLink()) {
        const real = fs.realpathSync(targetPath);
        if (!PathPolicy.isContained(workspaceRoot, real)) {
          return { safe: false, reason: `Symlink points outside workspace: ${real}` };
        }
      }
      return { safe: true };
    } catch (err: any) {
      return { safe: false, reason: `Failed to inspect symlink status: ${err.message}` };
    }
  }
}
