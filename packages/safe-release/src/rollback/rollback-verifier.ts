import type { DeploymentProvider, KnownGoodRelease } from "../types.js";

export class RollbackVerifier {
  public static async verifyRestoration(params: {
    provider: DeploymentProvider;
    targetRelease: KnownGoodRelease;
  }): Promise<{ verified: boolean; activeDigest: string; error?: string | undefined }> {
    const { provider, targetRelease } = params;
    const hostState = await provider.inspect({
      product: targetRelease.product,
      environment: targetRelease.environment,
      service: "web"
    });

    if (hostState.active_digest !== targetRelease.artifact_digest) {
      return {
        verified: false,
        activeDigest: hostState.active_digest,
        error: `RESTORED_DIGEST_MISMATCH: Host active digest '${hostState.active_digest}' does not match target release '${targetRelease.artifact_digest}'.`
      };
    }

    return {
      verified: true,
      activeDigest: hostState.active_digest
    };
  }
}
