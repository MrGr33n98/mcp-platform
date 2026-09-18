import type { ChangePlan } from "@mcp-platform/feature-engineering";
import type { VerificationReceipt } from "@mcp-platform/verification-engine";
import { VerificationReportBuilder } from "@mcp-platform/verification-engine";
import type { ApplyReceipt } from "@mcp-platform/apply-engine";
import type { GitReceipt } from "@mcp-platform/git-governance";
import type { CIReceipt, ReleaseArtifact } from "../types.js";

export interface ProvenanceValidationResult {
  valid: boolean;
  errors: string[];
}

export class ProvenanceChainValidator {
  public static validateChain(
    changePlan: ChangePlan,
    verificationReceipt: VerificationReceipt,
    applyReceipt: ApplyReceipt,
    gitReceipt: GitReceipt,
    ciReceipt: CIReceipt,
    artifact: ReleaseArtifact
  ): ProvenanceValidationResult {
    const errors: string[] = [];

    // 1. ChangePlan digest == VerificationReceipt.change_plan_digest
    const computedPlanDigest = VerificationReportBuilder.calculatePlanDigest(changePlan);
    if (computedPlanDigest !== verificationReceipt.change_plan_digest) {
      errors.push(
        `PROVENANCE_MISMATCH: ChangePlan digest (${computedPlanDigest}) does not match VerificationReceipt (${verificationReceipt.change_plan_digest}).`
      );
    }

    // 2. VerificationReceipt.verification_id == ApplyReceipt.verification_digest
    if (verificationReceipt.verification_id !== applyReceipt.verification_digest) {
      errors.push(
        `PROVENANCE_MISMATCH: VerificationReceipt verification_id (${verificationReceipt.verification_id}) does not match ApplyReceipt (${applyReceipt.verification_digest}).`
      );
    }

    // 3. ApplyReceipt.apply_id == GitReceipt.apply_id
    if (applyReceipt.apply_id !== gitReceipt.apply_id) {
      errors.push(
        `PROVENANCE_MISMATCH: ApplyReceipt apply_id (${applyReceipt.apply_id}) does not match GitReceipt (${gitReceipt.apply_id}).`
      );
    }

    // 4. GitReceipt.commit_sha == CIReceipt.commit_sha
    if (gitReceipt.commit_sha !== ciReceipt.commit_sha) {
      errors.push(
        `PROVENANCE_MISMATCH: GitReceipt commit_sha (${gitReceipt.commit_sha}) does not match CIReceipt commit_sha (${ciReceipt.commit_sha}).`
      );
    }

    // 5. Artifact source commit == GitReceipt.commit_sha
    if (artifact.source_commit !== gitReceipt.commit_sha) {
      errors.push(
        `PROVENANCE_MISMATCH: Artifact source commit (${artifact.source_commit}) does not match Git commit (${gitReceipt.commit_sha}).`
      );
    }

    // 6. CIReceipt.artifact_digests contains Artifact.digest
    if (!ciReceipt.artifact_digests.includes(artifact.digest)) {
      errors.push(
        `PROVENANCE_MISMATCH: CIReceipt does not contain artifact digest (${artifact.digest}). Available in CI: [${ciReceipt.artifact_digests.join(", ")}].`
      );
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
