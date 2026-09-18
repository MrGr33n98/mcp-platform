import type { CommandClass } from "../types.js";

export interface CommandPolicyCheckResult {
  allowed: boolean;
  commandClass: CommandClass;
  reason?: string | undefined;
}

export class CommandPolicy {
  private static readonly ALLOWED_BASE_COMMANDS: Record<string, CommandClass> = {
    "bundle exec rspec": "SAFE_TEST",
    "bundle exec rubocop": "READ_ONLY",
    "bin/rails zeitwerk:check": "READ_ONLY",
    "bundle check": "READ_ONLY",
    "npm test": "SAFE_TEST",
    "npm run test": "SAFE_TEST",
    "npm run typecheck": "SAFE_BUILD",
    "npm run build": "SAFE_BUILD",
    "git status": "READ_ONLY",
    "git branch": "READ_ONLY",
    "git rev-parse": "READ_ONLY"
  };

  private static readonly DISALLOWED_PATTERNS = [
    /rm\s+-rf/i,
    /drop\s+database/i,
    /db:drop/i,
    /db:migrate:reset/i,
    /git\s+push/i,
    /git\s+commit/i,
    /git\s+apply/i,
    /deploy/i,
    /kubectl/i,
    /terraform/i,
    /curl\s+/i,
    /wget\s+/i,
    /\beval\b/i,
    /;\s*/,
    /\|\s*/,
    /`.*`/,
    /\$\(.*\)/
  ];

  public static evaluateCommand(command: string): CommandPolicyCheckResult {
    const trimmed = command.trim();

    // Check for prohibited shell injection and chaining characters
    for (const pattern of this.DISALLOWED_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          allowed: false,
          commandClass: "DESTRUCTIVE",
          reason: `Command contains forbidden characters or dangerous patterns: ${pattern.toString()}`
        };
      }
    }

    // Check against strict allowlist
    for (const [allowedPrefix, cmdClass] of Object.entries(this.ALLOWED_BASE_COMMANDS)) {
      if (trimmed === allowedPrefix || trimmed.startsWith(`${allowedPrefix} `)) {
        const isPermittedInPhase5F =
          cmdClass === "READ_ONLY" || cmdClass === "SAFE_BUILD" || cmdClass === "SAFE_TEST";

        if (!isPermittedInPhase5F) {
          return {
            allowed: false,
            commandClass: cmdClass,
            reason: `Command class '${cmdClass}' is blocked during Phase 5F (VERIFY_ONLY).`
          };
        }

        return {
          allowed: true,
          commandClass: cmdClass
        };
      }
    }

    // Explicit classification for migrations and destructive commands
    if (/rails\s+db:migrate/i.test(trimmed)) {
      return {
        allowed: false,
        commandClass: "MIGRATION",
        reason: "Direct migration execution is forbidden in Phase 5F (VERIFY_ONLY)."
      };
    }

    return {
      allowed: false,
      commandClass: "DESTRUCTIVE",
      reason: `Command '${trimmed}' is not in the strict Phase 5F execution allowlist.`
    };
  }
}
