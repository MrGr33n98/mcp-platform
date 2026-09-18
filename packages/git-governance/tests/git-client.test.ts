import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitClient } from "../src/git/git-client.js";
import { GitSecurityViolationError } from "../src/security/git-command-policy.js";

const execFileAsync = promisify(execFile);

describe("GitClient", () => {
  let tmpRepoDir: string;
  let git: GitClient;

  beforeEach(async () => {
    tmpRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp_git_client_test_"));
    await execFileAsync("git", ["init", "-b", "main"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.name", "Tester"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["config", "user.email", "tester@mcp.local"], { cwd: tmpRepoDir });

    fs.writeFileSync(path.join(tmpRepoDir, "sample.txt"), "hello world\n", "utf8");
    await execFileAsync("git", ["add", "sample.txt"], { cwd: tmpRepoDir });
    await execFileAsync("git", ["commit", "-m", "initial commit"], { cwd: tmpRepoDir });

    git = new GitClient(tmpRepoDir);
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

  it("retrieves current branch and head commit", async () => {
    const branch = await git.getCurrentBranch();
    expect(branch).toBe("main");

    const head = await git.getHeadCommit();
    expect(head.length).toBe(40);
  });

  it("lists tracked files", async () => {
    const files = await git.listTrackedFiles();
    expect(files).toContain("sample.txt");
  });

  it("blocks forbidden subcommands", async () => {
    await expect(git.exec("clean", ["-fd"])).rejects.toThrow(GitSecurityViolationError);
    await expect(git.exec("reset", ["--hard"])).rejects.toThrow(GitSecurityViolationError);
  });
});
