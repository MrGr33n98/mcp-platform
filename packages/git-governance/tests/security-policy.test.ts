import { describe, it, expect } from "vitest";
import { GitCommandPolicy, GitSecurityViolationError } from "../src/security/git-command-policy.js";
import { ProtectedBranchPolicy } from "../src/security/protected-branch-policy.js";

describe("Git Governance Security Policies", () => {
  describe("GitCommandPolicy", () => {
    it("allows standard safe git subcommands", () => {
      expect(() => GitCommandPolicy.validateCommand("status", ["--porcelain=v1"])).not.toThrow();
      expect(() => GitCommandPolicy.validateCommand("diff", ["--cached"])).not.toThrow();
      expect(() => GitCommandPolicy.validateCommand("branch", ["--show-current"])).not.toThrow();
      expect(() => GitCommandPolicy.validateCommand("rev-parse", ["HEAD"])).not.toThrow();
      expect(() => GitCommandPolicy.validateCommand("ls-files", [])).not.toThrow();
    });

    it("strictly blocks forbidden destructive commands", () => {
      expect(() => GitCommandPolicy.validateCommand("reset", ["--hard"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("clean", ["-fd"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("rebase", ["main"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("filter-branch", [])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("merge", ["feature"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("tag", ["v1.0.0"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("stash", [])).toThrow(GitSecurityViolationError);
    });

    it("strictly blocks wildcard staging attempts (git add . / -A / *)", () => {
      expect(() => GitCommandPolicy.validateCommand("add", ["."])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("add", ["-A"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("add", ["--all"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("add", ["*"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("add", ["app/**/*.rb"])).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("add", [])).toThrow(GitSecurityViolationError);

      // Allows explicit paths
      expect(() =>
        GitCommandPolicy.validateCommand("add", ["app/models/webhook.rb", "config/routes.rb"])
      ).not.toThrow();
    });

    it("strictly blocks force push and remote branch deletion", () => {
      expect(() => GitCommandPolicy.validateCommand("push", ["origin", "feature", "--force"])).toThrow(
        GitSecurityViolationError
      );
      expect(() => GitCommandPolicy.validateCommand("push", ["origin", "feature", "-f"])).toThrow(
        GitSecurityViolationError
      );
      expect(() =>
        GitCommandPolicy.validateCommand("push", ["origin", "feature", "--force-with-lease"])
      ).toThrow(GitSecurityViolationError);
      expect(() => GitCommandPolicy.validateCommand("push", ["origin", "+feature"])).toThrow(
        GitSecurityViolationError
      );
      expect(() => GitCommandPolicy.validateCommand("push", ["origin", "--delete", "feature"])).toThrow(
        GitSecurityViolationError
      );

      // Safe push
      expect(() => GitCommandPolicy.validateCommand("push", ["-u", "origin", "mcp/webhooks/a1b2c3"])).not.toThrow();
    });

    it("blocks shell injection characters in arguments", () => {
      expect(() => GitCommandPolicy.validateCommand("add", ["file.rb; rm -rf /"])).toThrow(
        GitSecurityViolationError
      );
      expect(() => GitCommandPolicy.validateCommand("commit", ["-m", "message && echo hacked"])).toThrow(
        GitSecurityViolationError
      );
      expect(() => GitCommandPolicy.validateCommand("branch", ["`whoami`"])).toThrow(
        GitSecurityViolationError
      );
    });
  });

  describe("ProtectedBranchPolicy", () => {
    it("identifies default protected branches", () => {
      expect(ProtectedBranchPolicy.isProtected("main")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("master")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("production")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("prod")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("staging")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("release/1.0.0")).toBe(true);
      expect(ProtectedBranchPolicy.isProtected("mcp/webhooks/a81c29")).toBe(false);
      expect(ProtectedBranchPolicy.isProtected("feature/new-api")).toBe(false);
    });

    it("asserts against committing directly to protected branches", () => {
      expect(() => ProtectedBranchPolicy.assertNotProtected("main")).toThrow(GitSecurityViolationError);
      expect(() => ProtectedBranchPolicy.assertNotProtected("master")).toThrow(GitSecurityViolationError);
      expect(() => ProtectedBranchPolicy.assertNotProtected("mcp/feature/abc")).not.toThrow();
    });

    it("generates and formats valid isolated branch names", () => {
      const branch = ProtectedBranchPolicy.generateIsolatedBranchName("Outgoing Webhooks", "tx_987654321");
      expect(branch).toBe("mcp/outgoing-webhooks/tx987654");
      expect(ProtectedBranchPolicy.isProtected(branch)).toBe(false);
    });
  });
});
