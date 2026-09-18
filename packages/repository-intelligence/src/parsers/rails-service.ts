import fs from "node:fs/promises";
import path from "node:path";
import type { ServiceDefinition } from "../types.js";

export class RailsServiceParser {
  public static async parse(repoRoot: string): Promise<ServiceDefinition[]> {
    const services: ServiceDefinition[] = [];
    const serviceDirs = [
      path.join(repoRoot, "app", "services"),
      path.join(repoRoot, "backend", "app", "services")
    ];

    let targetDir = "";
    for (const d of serviceDirs) {
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

    if (!targetDir) return services;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const classMatch = content.match(/class\s+([A-Za-z0-9_:]+)/);
          const className = classMatch?.[1];
          if (className) {
            const methods: string[] = [];
            const methodMatches = content.matchAll(/def\s+(?:self\.)?([a-zA-Z0-9_]+[!_?]?)/g);
            for (const m of methodMatches) {
              if (m[1]) methods.push(m[1]);
            }

            services.push({
              name: className,
              file: fullPath,
              methods,
              evidence: {
                file: fullPath,
                symbol: className,
                evidence_type: "SERVICE",
                detector: "RailsServiceParser",
                confidence: "HIGH",
                description: `Domain service ${className} with methods [${methods.join(", ")}].`
              }
            });
          }
        }
      }
    }

    await walk(targetDir);
    return services;
  }
}
