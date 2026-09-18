import fs from "node:fs/promises";
import path from "node:path";
import type { ModelDefinition } from "../types.js";

export class RailsModelParser {
  public static async parse(repoRoot: string): Promise<ModelDefinition[]> {
    const models: ModelDefinition[] = [];
    const modelDirs = [
      path.join(repoRoot, "app", "models"),
      path.join(repoRoot, "backend", "app", "models")
    ];

    let targetDir = "";
    for (const d of modelDirs) {
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

    if (!targetDir) return models;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const modelDef = parseModelFile(fullPath, content);
          if (modelDef) {
            models.push(modelDef);
          }
        }
      }
    }

    function parseModelFile(filePath: string, content: string): ModelDefinition | null {
      const classMatch = content.match(/class\s+([A-Za-z0-9_:]+)\s*<\s*(?:ApplicationRecord|ActiveRecord::Base)/);
      const className = classMatch?.[1];
      if (!className) return null;

      const model: ModelDefinition = {
        name: className,
        tableName: className.toLowerCase().replace(/::/g, "_") + "s",
        file: filePath,
        associations: [],
        attributes: [],
        isTenantScoped: false,
        evidence: {
          file: filePath,
          symbol: className,
          evidence_type: "MODEL",
          detector: "RailsModelParser",
          confidence: "HIGH",
          description: `ActiveRecord model ${className} defined in ${path.basename(filePath)}.`
        }
      };

      const lines = content.split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (line.startsWith("#")) continue; // Skip comments to avoid false positive matches

        const assocMatch = line.match(/(belongs_to|has_many|has_one|has_and_belongs_to_many)\s+:(\w+)/);
        if (assocMatch && assocMatch[1] && assocMatch[2]) {
          const type = assocMatch[1] as ModelDefinition["associations"][0]["type"];
          const target = assocMatch[2];
          model.associations.push({ type, target });

          if (target === "organization" || target === "enterprise" || target === "tenant" || target === "account") {
            model.isTenantScoped = true;
            model.tenantKey = target + "_id";
          }
        }

        if (line.includes("acts_as_tenant")) {
          model.isTenantScoped = true;
        }
      }

      return model;
    }

    await walk(targetDir);
    return models;
  }
}
