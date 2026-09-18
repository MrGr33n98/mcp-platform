import { describe, it, expect } from "vitest";
import { CommandPolicy } from "../src/security/command-policy.js";
import { EnvironmentPolicy } from "../src/security/environment-policy.js";
import { SecretRedactor } from "../src/security/secret-redactor.js";
import { OutputSanitizer } from "../src/security/output-sanitizer.js";

describe("Verification Engine Security Policies", () => {
  describe("CommandPolicy", () => {
    it("allows safe read-only and safe test commands", () => {
      expect(CommandPolicy.evaluateCommand("bundle exec rspec").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("bundle exec rspec spec/models/user_spec.rb").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("bundle exec rubocop").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("bin/rails zeitwerk:check").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("npm test").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("npm run typecheck").allowed).toBe(true);
      expect(CommandPolicy.evaluateCommand("npm run build").allowed).toBe(true);
    });

    it("blocks destructive and write commands in Phase 5F", () => {
      expect(CommandPolicy.evaluateCommand("rails db:migrate").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("git push origin main").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("rm -rf /app").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("curl https://malicious.com").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("kubectl delete pod foo").allowed).toBe(false);
    });

    it("blocks command injection and shell chaining", () => {
      expect(CommandPolicy.evaluateCommand("bundle exec rspec; rm -rf /").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("npm test | bash").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("npm test `cat /etc/passwd`").allowed).toBe(false);
      expect(CommandPolicy.evaluateCommand("npm test $(cat /etc/passwd)").allowed).toBe(false);
    });
  });

  describe("EnvironmentPolicy", () => {
    it("allows safe test environment", () => {
      const result = EnvironmentPolicy.evaluateEnvironment({
        RAILS_ENV: "test",
        NODE_ENV: "test",
        DATABASE_URL: "postgres://postgres:postgres@localhost:5432/test_db"
      });
      expect(result.allowed).toBe(true);
    });

    it("blocks production environment variables", () => {
      expect(EnvironmentPolicy.evaluateEnvironment({ RAILS_ENV: "production" }).allowed).toBe(false);
      expect(EnvironmentPolicy.evaluateEnvironment({ STRIPE_SECRET_KEY: "sk_live_1234567890abcdef12345" }).allowed).toBe(false);
      expect(EnvironmentPolicy.evaluateEnvironment({ DATABASE_URL: "postgres://admin:pwd@prod-db.amazonaws.com/live" }).allowed).toBe(false);
    });

    it("sanitizes environment for safe execution", () => {
      const safe = EnvironmentPolicy.sanitizeEnvironmentForExecution({
        RAILS_ENV: "production",
        DATABASE_URL: "postgres://prod/live",
        STRIPE_SECRET_KEY: "sk_live_12345"
      });
      expect(safe["RAILS_ENV"]).toBe("test");
      expect(safe["DATABASE_URL"]).toBeUndefined();
      expect(safe["STRIPE_SECRET_KEY"]).toBeUndefined();
    });
  });

  describe("SecretRedactor & OutputSanitizer", () => {
    it("redacts live Stripe and API keys", () => {
      const raw = "Connecting with key sk_live_1234567890abcdef12345 and prefix gsk_live_abcdef1234567890123456";
      const redacted = SecretRedactor.redact(raw);
      expect(redacted).not.toContain("sk_live_1234567890abcdef12345");
      expect(redacted).toContain("sk_live_[REDACTED]");
      expect(redacted).toContain("gsk_live_[REDACTED]");
    });

    it("redacts Bearer tokens and passwords", () => {
      const raw = 'Header: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz, password="supersecretpass"';
      const redacted = SecretRedactor.redact(raw);
      expect(redacted).toContain("Bearer [REDACTED_TOKEN]");
      expect(redacted).toContain("password=[REDACTED]");
    });

    it("sanitizes ANSI escapes and redacts output", () => {
      const raw = "\u001b[32mSuccess\u001b[0m with key sk_live_9876543210fedcba987654";
      const clean = OutputSanitizer.sanitize(raw);
      expect(clean).not.toContain("\u001b[32m");
      expect(clean).toContain("Success with key sk_live_[REDACTED]");
    });
  });
});
