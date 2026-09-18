import type { RepositoryRevision } from "@mcp-platform/verification-engine";
import { WorkspaceVerifier } from "@mcp-platform/verification-engine";

export class RevisionValidator {
  public static validate(params: {
    workspaceRoot: string;
    expectedRevision: RepositoryRevision;
    customCurrentRevision?: RepositoryRevision | undefined;
  }): { valid: boolean; reason?: string | undefined; currentRevision: RepositoryRevision } {
    const current = params.customCurrentRevision || WorkspaceVerifier.captureRevision(params.workspaceRoot);

    if (current.commitSha !== params.expectedRevision.commitSha) {
      return {
        valid: false,
        reason: `REPOSITORY CHANGED (TOCTOU Detected): Current commit SHA '${current.commitSha}' differs from verification commit SHA '${params.expectedRevision.commitSha}'.`,
        currentRevision: current
      };
    }

    if (current.branch && params.expectedRevision.branch && current.branch !== params.expectedRevision.branch) {
      return {
        valid: false,
        reason: `BRANCH MISMATCH: Current branch '${current.branch}' differs from verification branch '${params.expectedRevision.branch}'.`,
        currentRevision: current
      };
    }

    return { valid: true, currentRevision: current };
  }
}
