import fs from "node:fs/promises";
import path from "node:path";

export interface InfraDetectionResult {
  hasDocker: boolean;
  hasDockerCompose: boolean;
  hasGithubActions: boolean;
  workflows: string[];
}

export class InfraDetector {
  public static async detect(repoRoot: string): Promise<InfraDetectionResult> {
    const result: InfraDetectionResult = {
      hasDocker: false,
      hasDockerCompose: false,
      hasGithubActions: false,
      workflows: []
    };

    // Dockerfile check
    const dockerPaths = [
      path.join(repoRoot, "Dockerfile"),
      path.join(repoRoot, "backend", "Dockerfile"),
      path.join(repoRoot, "frontend", "Dockerfile")
    ];

    for (const p of dockerPaths) {
      try {
        await fs.access(p);
        result.hasDocker = true;
        break;
      } catch {
        //
      }
    }

    // Docker Compose check
    const composePaths = [
      path.join(repoRoot, "docker-compose.yml"),
      path.join(repoRoot, "docker-compose.yaml"),
      path.join(repoRoot, "compose.yaml"),
      path.join(repoRoot, "compose.yml")
    ];

    for (const p of composePaths) {
      try {
        await fs.access(p);
        result.hasDockerCompose = true;
        break;
      } catch {
        //
      }
    }

    // GitHub Actions check
    const workflowsDir = path.join(repoRoot, ".github", "workflows");
    try {
      const files = await fs.readdir(workflowsDir);
      const yamlFiles = files.filter((f: string) => f.endsWith(".yml") || f.endsWith(".yaml"));
      if (yamlFiles.length > 0) {
        result.hasGithubActions = true;
        result.workflows = yamlFiles;
      }
    } catch {
      // No github workflows
    }

    return result;
  }
}
