import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitClient } from "../src/git/git-client.js";
import { BranchManager } from "../src/git/branch-manager.js";
import { GitSecurityViolationError } from "../src/security/git-command-policy.js";

const execFileAsync = promisify(execFile);

describe("BranchManager", () => {
  let tmpRepoDir: string;
  let git: GitClient;
  let branchManager: BranchManager;

  beforeEach(async () => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp_branch_mgr_test_"));
    await execFileAsync("git", ["init", "-b", "main"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.name", "Tester"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.email", "tester@mcp.local"], { cwd: tmpRepoDir });

    fs.writeFileSync(path.join(tmpRepoDir, "sample.txt"), "hello world\n", "utf8");
    await execFileAsync("git", ["add", "sample.txt"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["commit", "-m", "initial commit"], { cwd: tmpRepoDir });

    git = new GitClient(tmpRepoDir);
    branchManager = new BranchManager(git);
  });

  afterEach(() => {
    if (fs.existsSync(tmpRepoDir)) {
      try {
        fs.rmSync(tmpRepoDir, { recursive: true, force: true });
      } catch {
        // Ignore
      }
    }
  });

  it("creates an isolated mcp branch and switches to it", async () => {
    const result = await branchManager.createIsolatedBranch("webhooks", "op_12345");
    expect(result.branchName).toBe("mcp/webhooks/op12345");
    expect(result.sourceBranch).toBe("main");

    const current = await branchManager.getCurrentBranch();
    expect(current).toBe("mcp/webhooks/op12345");
  });

  it("rejects creating or switching to protected branches", async () => {
    await expect(branchManager.createIsolatedBranch("webhooks", "op_123", "main")).rejects.toThrow(
      GitSecurityViolationError
    );
    await expect(branchManager.createIsolatedBranch("webhooks", "op_123", "production")).rejects.toThrow(
      GitSecurityViolationError
    );
  });
});
