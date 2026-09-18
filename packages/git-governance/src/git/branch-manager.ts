import type { GitClient } from "./git-client.js";
import { ProtectedBranchPolicy } from "../security/protected-branch-policy.js";

export interface BranchCreationResult {
  branchName: string;
  sourceBranch: string;
  sourceCommit: string;
}

export class BranchManager {
  constructor(private readonly git: GitClient) {}

  public async createIsolatedBranch(
    capability: string,
    id: string,
    customBranchName?: string | undefined
  ): Promise<BranchCreationResult> {
    const sourceBranch = await this.git.getCurrentBranch();
    const sourceCommit = await this.git.getHeadCommit();

    const targetBranch = customBranchName
      ? customBranchName
      : ProtectedBranchPolicy.generateIsolatedBranchName(capability, id);

    ProtectedBranchPolicy.assertNotProtected(targetBranch);

    await this.git.switchNewBranch(targetBranch);

    return {
      branchName: targetBranch,
      sourceBranch,
      sourceCommit,
    };
  }

  public async getCurrentBranch(): Promise<string> {
    return this.git.getCurrentBranch();
  }
}
