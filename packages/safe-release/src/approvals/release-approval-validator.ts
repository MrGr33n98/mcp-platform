import { createHmac } from "node:crypto";
import type {
  EnvironmentType,
  ReleaseActionScope,
  ReleaseApprovalReceipt,
  ReleaseCandidate
} from "../types.js";

export interface ApprovalValidationResult {
  valid: boolean;
  errors: string[];
}

export class ReleaseApprovalValidator {
  private static consumedNonces: Set<string> = new Set();

  public static resetNonceRegistry(): void {
    this.consumedNonces.clear();
  }

  public static validate(params: {
    approval: ReleaseApprovalReceipt;
    candidate: ReleaseCandidate;
    expectedEnvironment: EnvironmentType;
    requiredAction: ReleaseActionScope;
    secretKey?: string | undefined;
  }): ApprovalValidationResult {
    const {
      approval,
      candidate,
      expectedEnvironment,
      requiredAction,
      secretKey = "mcp-platform-safe-release-secret-key"
    } = params;

    const errors: string[] = [];

    // 1. Replay Protection (Single-use)
    if (this.consumedNonces.has(approval.nonce)) {
      errors.push(`APPROVAL_REPLAY_DETECTED: Nonce '${approval.nonce}' was already used. Replay rejected.`);
    }

    // 2. Expiração
    const now = Date.now();
    const expiry = new Date(approval.expires_at).getTime();
    if (isNaN(expiry) || now > expiry) {
      errors.push(`APPROVAL_EXPIRED: Release approval expired at ${approval.expires_at}.`);
    }

    // 3. Binding de Candidato e Commit
    if (approval.release_candidate_id !== candidate.release_candidate_id) {
      errors.push(
        `APPROVAL_CANDIDATE_MISMATCH: Approval bound to RC '${approval.release_candidate_id}', but executing '${candidate.release_candidate_id}'.`
      );
    }
    if (approval.commit_sha !== candidate.commit_sha) {
      errors.push(
        `APPROVAL_COMMIT_MISMATCH: Approval bound to commit '${approval.commit_sha}', but RC is '${candidate.commit_sha}'.`
      );
    }

    // 4. Binding de Artefato
    if (approval.artifact_digest !== candidate.artifact.digest) {
      errors.push(
        `APPROVAL_ARTIFACT_MISMATCH: Approval bound to artifact digest '${approval.artifact_digest}', but RC artifact is '${candidate.artifact.digest}'.`
      );
    }

    // 5. Binding de Ambiente
    if (approval.environment !== expectedEnvironment) {
      errors.push(
        `APPROVAL_ENVIRONMENT_MISMATCH: Approval granted for environment '${approval.environment}', but target is '${expectedEnvironment}'.`
      );
    }

    // 6. Escopo de Ação (Scope Boundary)
    if (approval.allowed_action !== requiredAction) {
      errors.push(
        `APPROVAL_SCOPE_MISMATCH: Approval scope '${approval.allowed_action}' does not authorize requested action '${requiredAction}'.`
      );
    }

    // 7. Verificação de Autenticidade (HMAC)
    const payload = `${approval.approval_id}:${approval.approver_id}:${approval.environment}:${approval.release_candidate_id}:${approval.artifact_digest}:${approval.commit_sha}:${approval.allowed_action}:${approval.issued_at}:${approval.expires_at}:${approval.nonce}`;
    const expectedProof = createHmac("sha256", secretKey).update(payload).digest("hex");
    if (approval.authentication_proof !== expectedProof) {
      errors.push("APPROVAL_TAMPERED: Authentication proof signature verification failed.");
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public static consumeNonce(nonce: string): void {
    this.consumedNonces.add(nonce);
  }
}
