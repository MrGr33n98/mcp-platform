import fs from "node:fs/promises";
import path from "node:path";
import type { ControllerDefinition } from "../types.js";

export class RailsControllerParser {
  public static async parse(repoRoot: string): Promise<ControllerDefinition[]> {
    const controllers: ControllerDefinition[] = [];
    const controllerDirs = [
      path.join(repoRoot, "app", "controllers"),
      path.join(repoRoot, "backend", "app", "controllers")
    ];

    let targetDir = "";
    for (const d of controllerDirs) {
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

    if (!targetDir) return controllers;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const classMatch = content.match(/class\s+([A-Za-z0-9_:]+)\s*<\s*([A-Za-z0-9_:]+)/);
          const className = classMatch?.[1];
          if (className) {
            const actions: string[] = [];
            const actionMatches = content.matchAll(/def\s+([a-zA-Z0-9_]+)/g);
            for (const m of actionMatches) {
              if (m[1]) actions.push(m[1]);
            }

            const policyMatch = content.match(/authorize\s+([@a-zA-Z0-9_:]+)/);
            const tenantScoped = content.includes("current_organization") || 
                                 content.includes("current_enterprise") || 
                                 content.includes("Current.organization") || 
                                 content.includes("set_tenant");

            controllers.push({
              name: className,
              file: fullPath,
              actions,
              policyUsed: policyMatch?.[1],
              tenantScoped,
              evidence: {
                file: fullPath,
                symbol: className,
                evidence_type: "CODE_SYMBOL",
                detector: "RailsControllerParser",
                confidence: "HIGH",
                description: `Controller ${className} with actions [${actions.join(", ")}].`
              }
            });
          }
        }
      }
    }

    await walk(targetDir);
    return controllers;
  }
}
