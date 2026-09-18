import { createHmac, randomBytes } from "node:crypto";
import type { ApproverType } from "@mcp-platform/apply-engine";
import type {
  EnvironmentType,
  ReleaseActionScope,
  ReleaseApprovalReceipt,
  ReleaseCandidate
} from "../types.js";

export class ReleaseApprovalFactory {
  public static createApproval(params: {
    approverId: string;
    approverType: ApproverType;
    candidate: ReleaseCandidate;
    environment: EnvironmentType;
    allowedAction: ReleaseActionScope;
    ttlMinutes?: number | undefined;
    secretKey?: string | undefined;
  }): ReleaseApprovalReceipt {
    const {
      approverId,
      approverType,
      candidate,
      environment,
      allowedAction,
      ttlMinutes = 30,
      secretKey = "mcp-platform-safe-release-secret-key"
    } = params;

    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const nonce = randomBytes(16).toString("hex");
    const approvalId = `appr_rel_${Date.now()}_${randomBytes(4).toString("hex")}`;

    const payload = `${approvalId}:${approverId}:${environment}:${candidate.release_candidate_id}:${candidate.artifact.digest}:${candidate.commit_sha}:${allowedAction}:${issuedAt}:${expiresAt}:${nonce}`;
    const authenticationProof = createHmac("sha256", secretKey).update(payload).digest("hex");

    return {
      schema_version: 1,
      approval_id: approvalId,
      approver_id: approverId,
      approver_type: approverType,
      environment,
      release_candidate_id: candidate.release_candidate_id,
      artifact_digest: candidate.artifact.digest,
      commit_sha: candidate.commit_sha,
      allowed_action: allowedAction,
      issued_at: issuedAt,
      expires_at: expiresAt,
      nonce,
      authentication_proof: authenticationProof
    };
  }
}
