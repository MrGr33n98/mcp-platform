import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { VerificationCheckResult } from "../types.js";

export class DockerVerifier {
  public static verifyStatic(manifest: RepositoryManifest): VerificationCheckResult[] {
    const checks: VerificationCheckResult[] = [];
    const hasDocker = manifest.infra.docker || manifest.infra.compose;

    checks.push({
      id: "DOCKER-001-CONFIG",
      name: "Docker & Container Infrastructure",
      category: "DOCKER_PROFILE",
      status: "STATIC",
      verdict: "PASS",
      severity: "INFO",
      message: hasDocker ? "Docker / Docker Compose configuration found." : "No containerization infrastructure required by repository architecture."
    });

    return checks;
  }
}
