import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GitCommandPolicy, GitSecurityViolationError } from "../security/git-command-policy.js";
import { CredentialPolicy } from "../security/credential-policy.js";

const execFileAsync = promisify(execFile);

export interface GitExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class GitClient {
  constructor(private readonly workspaceRoot: string) {}

  public async exec(subcommand: string, args: string[] = []): Promise<GitExecResult> {
    GitCommandPolicy.validateCommand(subcommand, args);

    try {
      const fullArgs = [subcommand, ...args];
      const { stdout, stderr } = await execFileAsync("git", fullArgs, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024, // 10MB
        env: {
          ...process.env,
          // Force deterministic English output from git CLI
          LC_ALL: "C",
          GIT_TERMINAL_PROMPT: "0",
        },
      });

      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
      };
    } catch (err: unknown) {
      const execErr = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      const stdout = execErr.stdout ? execErr.stdout.toString() : "";
      const stderr = execErr.stderr ? execErr.stderr.toString() : (execErr.message || String(err));
      const exitCode = typeof execErr.code === "number" ? execErr.code : 1;

      const sanitizedError = CredentialPolicy.sanitizeString(stderr);
      throw new Error(`Git command 'git ${subcommand} ${args.join(" ")}' failed (exit code ${exitCode}): ${sanitizedError}`);
    }
  }

  public async getCurrentBranch(): Promise<string> {
    const res = await this.exec("branch", ["--show-current"]);
    return res.stdout.trim();
  }

  public async getHeadCommit(): Promise<string> {
    const res = await this.exec("rev-parse", ["HEAD"]);
    return res.stdout.trim();
  }

  public async getStatus(): Promise<string> {
    const res = await this.exec("status", ["--porcelain=v1", "-uall"]);
    return res.stdout;
  }

  public async getUnstagedDiff(): Promise<string> {
    const res = await this.exec("diff");
    return res.stdout;
  }

  public async getStagedDiff(): Promise<string> {
    const res = await this.exec("diff", ["--cached"]);
    return res.stdout;
  }

  public async getCommitDiff(commitSha: string): Promise<string> {
    const res = await this.exec("diff", [`${commitSha}~1`, commitSha]);
    return res.stdout;
  }

  public async switchNewBranch(branchName: string): Promise<void> {
    await this.exec("switch", ["-c", branchName]);
  }

  public async addExplicitFiles(relativePaths: string[]): Promise<void> {
    if (relativePaths.length === 0) {
      throw new GitSecurityViolationError("No files specified for staging.");
    }
    await this.exec("add", relativePaths);
  }

  public async commit(message: string): Promise<string> {
    await this.exec("commit", ["-m", message]);
    return this.getHeadCommit();
  }

  public async pushBranch(remote: string, branch: string): Promise<void> {
    await this.exec("push", ["-u", remote, branch]);
  }

  public async listTrackedFiles(): Promise<string[]> {
    const res = await this.exec("ls-files");
    return res.stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
  }
}
