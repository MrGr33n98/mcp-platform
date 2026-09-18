import path from "node:path";
import fs from "node:fs/promises";
import type { SpecDefinition } from "../types.js";
import { UnsafeFilePolicy } from "../security/unsafe-file-policy.js";

export class RailsSpecParser {
  public static async parse(repoRoot: string): Promise<SpecDefinition[]> {
    const specs: SpecDefinition[] = [];
    const specDir = path.join(repoRoot, "spec");

    try {
      await fs.stat(specDir);
    } catch {
      return specs; // No spec dir
    }

    async function walk(currentDir: string) {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          if (UnsafeFilePolicy.isIgnored(fullPath)) continue;

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (entry.isFile() && entry.name.endsWith("_spec.rb")) {
            const relPath = path.relative(repoRoot, fullPath).replace(/\\/g, "/");
            let type: SpecDefinition["type"] = "other";
            let targetComponent: string | undefined = undefined;

            const baseName = entry.name.replace(/_spec\.rb$/, "");

            if (relPath.includes("spec/models/")) {
              type = "model";
              targetComponent = RailsSpecParser.classify(baseName);
            } else if (relPath.includes("spec/requests/") || relPath.includes("spec/controllers/")) {
              type = "request";
              const clean = baseName.replace(/_controller$/, "");
              targetComponent = RailsSpecParser.classify(clean) + "Controller";
            } else if (relPath.includes("spec/policies/")) {
              type = "policy";
              const clean = baseName.replace(/_policy$/, "");
              targetComponent = RailsSpecParser.classify(clean) + "Policy";
            } else if (relPath.includes("spec/services/")) {
              type = "service";
              const clean = baseName.replace(/_service$/, "");
              targetComponent = RailsSpecParser.classify(clean) + "Service";
            } else if (relPath.includes("spec/jobs/")) {
              type = "job";
              const clean = baseName.replace(/_job$/, "");
              targetComponent = RailsSpecParser.classify(clean) + "Job";
            } else if (relPath.includes("spec/system/")) {
              type = "system";
            }

            specs.push({
              file: relPath,
              type,
              targetComponent,
              evidence: {
                file: relPath,
                evidence_type: "TEST",
                detector: "RailsSpecParser",
                confidence: "HIGH",
                description: `Found RSpec file ${relPath} targeting ${targetComponent || "general behavior"}.`
              }
            });
          }
        }
      } catch {
        // Ignore read errors
      }
    }

    await walk(specDir);
    return specs;
  }

  private static classify(str: string): string {
    return str
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  }
}
