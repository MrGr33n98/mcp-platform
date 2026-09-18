import fs from "node:fs/promises";
import path from "node:path";
import type { RouteDefinition } from "../types.js";

export class RailsRoutesParser {
  public static async parse(repoRoot: string): Promise<RouteDefinition[]> {
    const routes: RouteDefinition[] = [];
    const routePaths = [
      path.join(repoRoot, "config", "routes.rb"),
      path.join(repoRoot, "backend", "config", "routes.rb")
    ];

    let content = "";
    let matchedFile = "";
    for (const p of routePaths) {
      try {
        content = await fs.readFile(p, "utf-8");
        matchedFile = p;
        break;
      } catch {
        //
      }
    }

    if (!content) return routes;

    const lines = content.split("\n");
    const currentNamespace: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() ?? "";

      const nsMatch = line.match(/namespace\s+:(\w+)\s+do/);
      if (nsMatch && nsMatch[1]) {
        currentNamespace.push(nsMatch[1]);
        continue;
      }

      if (line === "end" && currentNamespace.length > 0) {
        currentNamespace.pop();
        continue;
      }

      const verbMatch = line.match(/(get|post|patch|put|delete)\s+["']([^"']+)["'](?:,\s*to:\s*["']([^"']+)#([^"']+)["'])?/i);
      if (verbMatch && verbMatch[1] && verbMatch[2]) {
        const method = verbMatch[1].toUpperCase();
        const rawPath = verbMatch[2];
        const controller = verbMatch[3] ?? rawPath.split("/")[0] ?? "unknown";
        const action = verbMatch[4] ?? "custom";

        const prefix = currentNamespace.length > 0 ? "/" + currentNamespace.join("/") : "";
        const fullPath = (prefix + "/" + rawPath).replace(/\/+/g, "/");
        const fullController = (currentNamespace.length > 0 ? currentNamespace.join("/") + "/" : "") + controller;

        routes.push({
          method,
          path: fullPath,
          controller: fullController,
          action,
          file: matchedFile,
          line: i + 1,
          evidence: {
            file: matchedFile,
            line_start: i + 1,
            line_end: i + 1,
            symbol: `${method} ${fullPath} -> ${fullController}#${action}`,
            evidence_type: "ROUTE",
            detector: "RailsRoutesParser",
            confidence: "HIGH",
            description: `Defined route ${method} ${fullPath} in routes.rb.`
          }
        });
        continue;
      }

      const resMatch = line.match(/resources\s+:(\w+)(?:,\s*only:\s*\[([^\]]+)\])?/);
      if (resMatch && resMatch[1]) {
        const resourceName = resMatch[1];
        const onlyActions = resMatch[2] ? resMatch[2].replace(/[:\s]/g, "").split(",") : ["index", "create", "show", "update", "destroy"];
        const prefix = currentNamespace.length > 0 ? "/" + currentNamespace.join("/") : "";
        const fullController = (currentNamespace.length > 0 ? currentNamespace.join("/") + "/" : "") + resourceName;

        for (const act of onlyActions) {
          let method = "GET";
          let pth = `${prefix}/${resourceName}`;
          if (act === "create") method = "POST";
          else if (act === "show") pth = `${prefix}/${resourceName}/:id`;
          else if (act === "update") {
            method = "PATCH";
            pth = `${prefix}/${resourceName}/:id`;
          } else if (act === "destroy") {
            method = "DELETE";
            pth = `${prefix}/${resourceName}/:id`;
          }

          routes.push({
            method,
            path: pth.replace(/\/+/g, "/"),
            controller: fullController,
            action: act,
            file: matchedFile,
            line: i + 1,
            evidence: {
              file: matchedFile,
              line_start: i + 1,
              line_end: i + 1,
              symbol: `resources :${resourceName} [${act}]`,
              evidence_type: "ROUTE",
              detector: "RailsRoutesParser",
              confidence: "HIGH",
              description: `RESTful resource route for ${resourceName}#${act}.`
            }
          });
        }
      }
    }

    return routes;
  }
}
