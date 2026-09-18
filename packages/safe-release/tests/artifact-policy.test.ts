import { describe, it, expect } from "vitest";
import { ArtifactValidator } from "../src/candidate/artifact-validator.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("ArtifactValidator", () => {
  it("passes for valid immutable tag and sha256 digest", () => {
    const { artifact } = createValidTestChain();
    const result = ArtifactValidator.validate(artifact);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("blocks mutable tag :latest and other mutable branch names", () => {
    const { artifact } = createValidTestChain();
    const mutableTags = ["latest", "Latest", "master", "main", "dev", "staging", "nightly"];

    for (const tag of mutableTags) {
      artifact.immutable_tag = tag;
      const result = ArtifactValidator.validate(artifact);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("MUTABLE_TAG_FORBIDDEN");
    }
  });

  it("blocks invalid digest format (missing sha256 prefix or invalid hex length)", () => {
    const { artifact } = createValidTestChain();
    artifact.digest = "md5:123456";

    const result = ArtifactValidator.validate(artifact);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("INVALID_DIGEST_FORMAT");
  });
});
