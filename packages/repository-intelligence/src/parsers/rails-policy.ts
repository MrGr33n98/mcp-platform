import fs from "node:fs/promises";
import path from "node:path";
import type { PolicyDefinition } from "../types.js";

export class RailsPolicyParser {
  public static async parse(repoRoot: string): Promise<PolicyDefinition[]> {
    const policies: PolicyDefinition[] = [];
    const policyDirs = [
      path.join(repoRoot, "app", "policies"),
      path.join(repoRoot, "backend", "app", "policies")
    ];

    let targetDir = "";
    for (const d of policyDirs) {
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

    if (!targetDir) return policies;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const classMatch = content.match(/class\s+([A-Za-z0-9_:]+Policy)\s*<\s*([A-Za-z0-9_:]+)/);
          const className = classMatch?.[1];
          if (className) {
            const modelName = className.replace(/Policy$/, "");
            const actions: string[] = [];
            const actionMatches = content.matchAll(/def\s+([a-zA-Z0-9_]+)\?/g);
            for (const m of actionMatches) {
              if (m[1]) actions.push(m[1]);
            }

            policies.push({
              name: className,
              file: fullPath,
              model: modelName,
              actions,
              evidence: {
                file: fullPath,
                symbol: className,
                evidence_type: "POLICY",
                detector: "RailsPolicyParser",
                confidence: "HIGH",
                description: `Pundit policy ${className} protecting model ${modelName} with actions [${actions.join(", ")}].`
              }
            });
          }
        }
      }
    }

    await walk(targetDir);
    return policies;
  }
}
