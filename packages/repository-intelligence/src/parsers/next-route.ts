import fs from "node:fs/promises";
import path from "node:path";
import type { NextRouteDefinition } from "../types.js";
import { UnsafeFilePolicy } from "../security/unsafe-file-policy.js";

export class NextRouteParser {
  public static async parse(repoRoot: string): Promise<NextRouteDefinition[]> {
    const routes: NextRouteDefinition[] = [];
    const appDirs = [
      path.join(repoRoot, "app"),
      path.join(repoRoot, "src", "app"),
      path.join(repoRoot, "frontend", "app"),
      path.join(repoRoot, "frontend", "src", "app")
    ];

    let targetDir = "";
    for (const d of appDirs) {
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

    if (!targetDir) return routes;

    async function walk(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (UnsafeFilePolicy.isIgnored(fullPath)) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            if (/^(page|route|layout)\.(tsx|ts|jsx|js)$/.test(entry.name)) {
              const relFromApp = path.relative(targetDir, fullPath).replace(/\\/g, "/");
              const parts = relFromApp.split("/");
              const fileName = parts.pop()!;
              
              // Filter out route groups like (auth)
              const cleanParts = parts.filter((p) => !p.startsWith("(") || !p.endsWith(")"));
              const routePath = "/" + cleanParts.join("/");

              const type = fileName.startsWith("page") 
                ? "page" 
                : fileName.startsWith("route") 
                ? "route_handler" 
                : "layout";

              routes.push({
                path: routePath === "//" ? "/" : routePath,
                file: fullPath,
                type,
                evidence: {
                  file: fullPath,
                  symbol: routePath,
                  evidence_type: "ROUTE",
                  detector: "NextRouteParser",
                  confidence: "HIGH",
                  description: `Next.js App Router ${type} at ${routePath}.`
                }
              });
            }
          }
        }
      } catch {
        //
      }
    }

    await walk(targetDir);
    return routes;
  }
}
