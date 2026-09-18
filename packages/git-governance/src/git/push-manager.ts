import { createHash } from "node:crypto";
import type { GitClient } from "./git-client.js";
import type { PushReport } from "../types.js";
import { ProtectedBranchPolicy } from "../security/protected-branch-policy.js";
import { GitSecurityViolationError } from "../security/git-command-policy.js";

export class PushManager {
  constructor(private readonly git: GitClient) {}

  public async pushIsolatedBranch(remoteName: string, branchName: string): Promise<PushReport> {
    if (!remoteName || !remoteName.trim()) {
      throw new GitSecurityViolationError("Remote name must be explicitly specified for push.");
    }

    ProtectedBranchPolicy.assertNotProtected(branchName);

    const commitSha = await this.git.getHeadCommit();

    // Check remote url
    let remoteUrlFingerprint = "unknown";
    try {
      const remoteRes = await this.git.exec("rev-parse", ["--symbolic-full-name", "@{u}"]);
      remoteUrlFingerprint = createHash("sha256").update(remoteRes.stdout.trim()).digest("hex").substring(0, 12);
    } catch {
      // Remote might be newly pushed
      remoteUrlFingerprint = createHash("sha256").update(remoteName).digest("hex").substring(0, 12);
    }

    await this.git.pushBranch(remoteName, branchName);

    return {
      remote_name: remoteName,
      remote_url_fingerprint: remoteUrlFingerprint,
      branch_name: branchName,
      commit_sha: commitSha,
      pushed_at: new Date().toISOString(),
      status: "SUCCESS",
    };
  }
}
