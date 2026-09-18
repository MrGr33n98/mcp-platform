import fs from "node:fs/promises";
import path from "node:path";
import type { AdminResourceDefinition } from "../types.js";

export class ActiveAdminParser {
  public static async parse(repoRoot: string): Promise<AdminResourceDefinition[]> {
    const resources: AdminResourceDefinition[] = [];
    const adminDirs = [
      path.join(repoRoot, "app", "admin"),
      path.join(repoRoot, "backend", "app", "admin")
    ];

    let targetDir = "";
    for (const d of adminDirs) {
      try {
        const stat = await fs.stat(d);
        if (stat.isDirectory()) {
          targetDir = d;
          break;
        }
      } catch {
        //
      }
    }

    if (!targetDir) return resources;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const registerMatch = content.match(/ActiveAdmin\.register\s+([A-Za-z0-9_:]+)/);
          const modelName = registerMatch?.[1];
          if (modelName) {
            resources.push({
              name: modelName,
              file: fullPath,
              model: modelName,
              evidence: {
                file: fullPath,
                symbol: modelName,
                evidence_type: "ADMIN_RESOURCE",
                detector: "ActiveAdminParser",
                confidence: "HIGH",
                description: `ActiveAdmin backoffice resource for ${modelName}.`
              }
            });
          }
        }
      }
    }

    await walk(targetDir);
    return resources;
  }
}
