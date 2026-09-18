import { describe, it, expect } from "vitest";
import { SecretRedactor } from "../src/security/secret-redactor.js";
import { PIIRedactor } from "../src/security/pii-redactor.js";
import { QueryPolicy } from "../src/security/query-policy.js";

describe("Security & Redaction", () => {
  it("redacts credentials and tokens from text", () => {
    const fakeStripe = ["sk", "live", "1234567890abcdef1234567890abcdef"].join("_");
    const log = `
      Failed request with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeak
      Connected using postgres://app_user:SuperSecretPassword123!@db.internal:5432/production
      AWS_KEY=AKIA1234567890ABCDEF
      STRIPE=${fakeStripe}
      RAILS_MASTER_KEY="0123456789abcdef0123456789abcdef"
    `;

    const sanitized = SecretRedactor.redact(log);

    expect(sanitized).toContain("Bearer [REDACTED_TOKEN]");
    expect(sanitized).toContain("[REDACTED_PASSWORD]");
    expect(sanitized).toContain("[REDACTED_AWS_KEY]");
    expect(sanitized).toContain("[REDACTED_STRIPE_KEY]");
    expect(sanitized).toContain("RAILS_MASTER_KEY=[REDACTED_MASTER_KEY]");
    expect(sanitized).not.toContain("SuperSecretPassword123!");
    expect(sanitized).not.toContain("AKIA1234567890ABCDEF");
  });

  it("redacts PII (emails, IPs, CPFs)", () => {
    const raw = "User john.doe@example.com from IP 203.0.113.45 with CPF 123.456.789-00 experienced error.";
    const sanitized = PIIRedactor.redact(raw);

    expect(sanitized).toContain("[REDACTED_EMAIL]");
    expect(sanitized).toContain("[REDACTED_IP]");
    expect(sanitized).toContain("[REDACTED_CPF]");
    expect(sanitized).not.toContain("john.doe@example.com");
    expect(sanitized).not.toContain("203.0.113.45");
  });

  it("validates SQL read-only policy strictly", () => {
    const safe = QueryPolicy.validateCustomQuery("SELECT count(*) FROM webhook_endpoints WHERE status = 'failed'");
    expect(safe.valid).toBe(true);

    const forbidden1 = QueryPolicy.validateCustomQuery("DELETE FROM webhook_endpoints");
    expect(forbidden1.valid).toBe(false);

    const forbidden2 = QueryPolicy.validateCustomQuery("DROP TABLE users");
    expect(forbidden2.valid).toBe(false);

    const forbidden3 = QueryPolicy.validateCustomQuery("UPDATE users SET admin = true");
    expect(forbidden3.valid).toBe(false);
  });
});
