import type { ReleaseArtifact } from "../types.js";
import { ArtifactValidator } from "../candidate/artifact-validator.js";

export class ArtifactPolicy {
  public static assertImmutableArtifact(artifact: ReleaseArtifact): void {
    const result = ArtifactValidator.validate(artifact);
    if (!result.valid) {
      throw new Error(`ARTIFACT_POLICY_VIOLATION: ${result.errors.join(" | ")}`);
    }
  }
}
