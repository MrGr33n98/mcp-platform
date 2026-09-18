import type { ReleaseArtifact } from "../types.js";

const MUTABLE_TAG_PATTERNS = [
  /^latest$/i,
  /^master$/i,
  /^main$/i,
  /^dev$/i,
  /^develop$/i,
  /^staging$/i,
  /^test$/i,
  /^nightly$/i,
  /^stable$/i,
  /^head$/i
];

export interface ArtifactValidationResult {
  valid: boolean;
  errors: string[];
}

export class ArtifactValidator {
  public static validate(artifact: ReleaseArtifact): ArtifactValidationResult {
    const errors: string[] = [];

    // 1. Tag Mutável proibida
    const tag = artifact.immutable_tag.trim();
    for (const pattern of MUTABLE_TAG_PATTERNS) {
      if (pattern.test(tag)) {
        errors.push(
          `MUTABLE_TAG_FORBIDDEN: Artifact tag '${artifact.immutable_tag}' is mutable. Mutable tags (e.g. :latest, :dev, :main) are strictly forbidden in safe releases.`
        );
        break;
      }
    }

    // 2. Validação do Digest SHA-256
    const digest = artifact.digest.trim();
    if (!digest.startsWith("sha256:")) {
      errors.push(
        `INVALID_DIGEST_FORMAT: Digest '${artifact.digest}' must begin with 'sha256:' prefix.`
      );
    } else {
      const hashPart = digest.slice("sha256:".length);
      if (!/^[a-fA-F0-9]{64}$/.test(hashPart)) {
        errors.push(
          `INVALID_DIGEST_HASH: Digest '${artifact.digest}' does not contain a valid 64-character hex SHA-256 hash.`
        );
      }
    }

    // 3. Source commit e Build ID obrigatórios
    if (!artifact.source_commit || artifact.source_commit.trim().length === 0) {
      errors.push("MISSING_SOURCE_COMMIT: Artifact must specify an immutable source commit SHA.");
    }
    if (!artifact.build_id || artifact.build_id.trim().length === 0) {
      errors.push("MISSING_BUILD_ID: Artifact must specify an immutable build ID.");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
