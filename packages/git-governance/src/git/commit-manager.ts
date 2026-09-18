import { createHash } from "node:crypto";
import type { GitClient } from "./git-client.js";
import type { CommitMetadata, CommitReport } from "../types.js";
import type { ChangePlan, VerticalSlicePlan } from "@mcp-platform/feature-engineering";
import { CredentialPolicy } from "../security/credential-policy.js";

export interface CommitParams {
  changePlan: ChangePlan;
  verticalSlicePlan?: VerticalSlicePlan | undefined;
  applyId: string;
  approvalId: string;
  verificationDigest: string;
  stagedFiles: string[];
  customMessage?: string | undefined;
}

export class CommitManager {
  constructor(private readonly git: GitClient) {}

  public async createGovernanceCommit(params: CommitParams): Promise<CommitReport> {
    const parentSha = await this.git.getHeadCommit();
    const commitMessage = this.formatCommitMessage(params);

    const commitSha = await this.git.commit(commitMessage);

    // Get tree SHA
    const treeRes = await this.git.exec("rev-parse", [`${commitSha}^{tree}`]);
    const treeSha = treeRes.stdout.trim();

    // Calculate diff digest of the commit
    const commitDiff = await this.git.getCommitDiff(commitSha);
    const diffDigest = createHash("sha256").update(commitDiff).digest("hex");

    const planId = `${params.changePlan.product}-${params.changePlan.capability}`;
    const planDigest = createHash("sha256").update(JSON.stringify(params.changePlan)).digest("hex");

    const metadata: CommitMetadata = {
      commit_sha: commitSha,
      parent_sha: parentSha,
      tree_sha: treeSha,
      author: "mcp-platform-bot <bot@mcp-platform.local>",
      message: commitMessage,
      timestamp: new Date().toISOString(),
      files_committed: params.stagedFiles,
      diff_digest: diffDigest,
      change_plan_digest: planDigest,
      verification_digest: params.verificationDigest,
      apply_id: params.applyId,
      approval_id: params.approvalId,
    };

    // Verify status
    const status = await this.git.getStatus();
    const isClean = status.trim().length === 0;

    return {
      commit_metadata: metadata,
      verification_status: "VERIFIED",
      working_tree_clean: isClean,
    };
  }

  public formatCommitMessage(params: CommitParams): string {
    if (params.customMessage) {
      return CredentialPolicy.sanitizeString(params.customMessage);
    }

    const title = params.verticalSlicePlan?.title || `apply ${params.changePlan.capability} changes`;
    const capability = params.changePlan.capability || "core";

    const header = `feat(${capability}): ${title.toLowerCase()}`;
    const body = [
      params.verticalSlicePlan?.description || `Automated change applied via MCP Platform for ${params.changePlan.product}.`,
      "",
      `MCP-Product: ${params.changePlan.product}`,
      `MCP-Capability: ${params.changePlan.capability}`,
      `MCP-Verification-Digest: ${params.verificationDigest}`,
      `MCP-Apply-ID: ${params.applyId}`,
      `MCP-Approval-ID: ${params.approvalId}`,
    ].join("\n");

    return `${header}\n\n${body}`;
  }
}
