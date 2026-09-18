import fs from "node:fs/promises";
import path from "node:path";
import type { JobDefinition } from "../types.js";

export class RailsJobParser {
  public static async parse(repoRoot: string): Promise<JobDefinition[]> {
    const jobs: JobDefinition[] = [];
    const jobDirs = [
      path.join(repoRoot, "app", "jobs"),
      path.join(repoRoot, "backend", "app", "jobs")
    ];

    let targetDir = "";
    for (const d of jobDirs) {
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

    if (!targetDir) return jobs;

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".rb")) {
          const content = await fs.readFile(fullPath, "utf-8");
          const classMatch = content.match(/class\s+([A-Za-z0-9_:]+)\s*<\s*(?:ApplicationJob|ActiveJob::Base)/);
          const className = classMatch?.[1];
          if (className) {
            const queueMatch = content.match(/queue_as\s+:([a-zA-Z0-9_]+)/);
            const queue = queueMatch?.[1] || "default";

            jobs.push({
              name: className,
              file: fullPath,
              queue,
              evidence: {
                file: fullPath,
                symbol: className,
                evidence_type: "JOB",
                detector: "RailsJobParser",
                confidence: "HIGH",
                description: `ActiveJob/Sidekiq worker ${className} on queue :${queue}.`
              }
            });
          }
        }
      }
    }

    await walk(targetDir);
    return jobs;
  }
}
