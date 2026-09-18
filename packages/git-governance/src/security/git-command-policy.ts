export class GitSecurityViolationError extends Error {
  constructor(message: string) {
    super(`[GitSecurityPolicyViolation] ${message}`);
    this.name = "GitSecurityViolationError";
  }
}

export class GitCommandPolicy {
  private static readonly ALLOWED_COMMANDS = new Set([
    "status",
    "rev-parse",
    "branch",
    "diff",
    "ls-files",
    "switch",
    "checkout",
    "add",
    "commit",
    "push",
    "log",
    "show",
    "cat-file",
  ]);

  private static readonly FORBIDDEN_COMMANDS = new Set([
    "reset",
    "clean",
    "rebase",
    "filter-branch",
    "merge",
    "tag",
    "restore",
    "stash",
    "rm",
    "mv",
    "cherry-pick",
    "revert",
    "bisect",
    "submodule",
    "clone",
    "init",
    "fetch",
    "pull",
  ]);

  private static readonly SHELL_INJECTION_REGEX = /[;&|`$<>\\]/;

  public static validateCommand(subcommand: string, args: string[]): void {
    const cmd = subcommand.trim().toLowerCase();

    if (this.FORBIDDEN_COMMANDS.has(cmd)) {
      throw new GitSecurityViolationError(`Git subcommand '${cmd}' is strictly forbidden by policy.`);
    }

    if (!this.ALLOWED_COMMANDS.has(cmd)) {
      throw new GitSecurityViolationError(`Git subcommand '${cmd}' is not in the allowed command policy.`);
    }

    for (const arg of args) {
      if (this.SHELL_INJECTION_REGEX.test(arg)) {
        throw new GitSecurityViolationError(`Shell metacharacters detected in git argument: "${arg}"`);
      }
    }

    if (cmd === "add") {
      this.validateAddArgs(args);
    }

    if (cmd === "push") {
      this.validatePushArgs(args);
    }

    if (cmd === "commit") {
      this.validateCommitArgs(args);
    }

    if (cmd === "switch" || cmd === "checkout") {
      this.validateSwitchArgs(args);
    }
  }

  private static validateAddArgs(args: string[]): void {
    if (args.length === 0) {
      throw new GitSecurityViolationError("git add requires explicit file paths; empty argument list is forbidden.");
    }

    for (const arg of args) {
      const trimmed = arg.trim();
      if (
        trimmed === "." ||
        trimmed === "-A" ||
        trimmed === "--all" ||
        trimmed === "-u" ||
        trimmed === "--update" ||
        trimmed === "*" ||
        trimmed.includes("*") ||
        trimmed.includes("?")
      ) {
        throw new GitSecurityViolationError(
          `Wildcard or bulk staging ('${arg}') is strictly forbidden. Explicit declared paths only.`
        );
      }
      if (trimmed.startsWith("-")) {
        throw new GitSecurityViolationError(`Unsupported flag in git add: '${arg}'`);
      }
    }
  }

  private static validatePushArgs(args: string[]): void {
    for (const arg of args) {
      const trimmed = arg.trim().toLowerCase();
      if (
        trimmed === "--force" ||
        trimmed === "-f" ||
        trimmed === "--force-with-lease" ||
        trimmed === "--force-if-includes" ||
        trimmed.startsWith("+")
      ) {
        throw new GitSecurityViolationError(
          `Force push ('${arg}') is strictly forbidden by Git Governance Policy.`
        );
      }
      if (trimmed === "--delete" || trimmed === "-d") {
        throw new GitSecurityViolationError(
          `Remote branch deletion ('${arg}') is strictly forbidden by Git Governance Policy.`
        );
      }
    }
  }

  private static validateCommitArgs(args: string[]): void {
    for (const arg of args) {
      const trimmed = arg.trim().toLowerCase();
      if (trimmed === "--amend" || trimmed === "-a" || trimmed === "--all") {
        throw new GitSecurityViolationError(
          `Flag '${arg}' is forbidden during commit to preserve history and staging isolation.`
        );
      }
    }
  }

  private static validateSwitchArgs(args: string[]): void {
    for (const arg of args) {
      const trimmed = arg.trim();
      if (trimmed === "--discard-changes" || trimmed === "-f" || trimmed === "--force") {
        throw new GitSecurityViolationError(
          `Force switch flag '${arg}' is forbidden.`
        );
      }
    }
  }
}
