import { describe, it, expect } from "vitest";
import { ProvenanceChainValidator } from "../src/candidate/provenance-validator.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("ProvenanceChainValidator", () => {
  it("passes when the entire receipt chain is cryptographically aligned", () => {
    const chain = createValidTestChain();
    const result = ProvenanceChainValidator.validateChain(
      chain.changePlan,
      chain.verificationReceipt,
      chain.applyReceipt,
      chain.gitReceipt,
      chain.ciReceipt,
      chain.artifact
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("blocks when ChangePlan digest does not match VerificationReceipt", () => {
    const chain = createValidTestChain();
    chain.verificationReceipt.change_plan_digest = "sha256:tampered_digest_9999999999999999999999999999999999999999999999999999999999999999";

    const result = ProvenanceChainValidator.validateChain(
      chain.changePlan,
      chain.verificationReceipt,
      chain.applyReceipt,
      chain.gitReceipt,
      chain.ciReceipt,
      chain.artifact
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("PROVENANCE_MISMATCH: ChangePlan digest");
  });

  it("blocks when GitReceipt commit does not match CI tested commit", () => {
    const chain = createValidTestChain();
    chain.ciReceipt.commit_sha = "ffffffffffffffffffffffffffffffffffffffff";

    const result = ProvenanceChainValidator.validateChain(
      chain.changePlan,
      chain.verificationReceipt,
      chain.applyReceipt,
      chain.gitReceipt,
      chain.ciReceipt,
      chain.artifact
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("PROVENANCE_MISMATCH: GitReceipt commit_sha");
  });

  it("blocks when artifact digest is not registered in CI Receipt", () => {
    const chain = createValidTestChain();
    chain.ciReceipt.artifact_digests = ["sha256:different_build_digest_9999999999999999999999999999999999999999999999999999999999999999"];

    const result = ProvenanceChainValidator.validateChain(
      chain.changePlan,
      chain.verificationReceipt,
      chain.applyReceipt,
      chain.gitReceipt,
      chain.ciReceipt,
      chain.artifact
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("CIReceipt does not contain artifact digest");
  });
});
