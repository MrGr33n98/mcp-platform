import { describe, it, expect } from "vitest";
import { redactSecrets } from "@mcp-platform/core";
import { SecretDetector } from "@mcp-platform/repository-intelligence";

describe("Engineering MCP Secret Redaction & Detection", () => {
  it("redacts sensitive keys from tool output payload", () => {
    const rawOutput = {
      repository: "test-repo",
      apiKey: "secret_live_api_key_12345",
      password: "SuperSecretPassword!",
      normalField: "public_value",
      nested: {
        stripe_secret: "sk_live_abcdef123456",
        token: "jwt_token_sample",
      },
    };

    const redacted: any = redactSecrets(rawOutput);

    expect(redacted.apiKey).toBe("[REDACTED]");
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.normalField).toBe("public_value");
    expect(redacted.nested.stripe_secret).toBe("[REDACTED]");
    expect(redacted.nested.token).toBe("[REDACTED]");
  });

  it("detects and redacts secrets in repository source code scan", () => {
    const secretLine = 'STRIPE_SECRET_KEY = "sk_live_999998888877777"';
    const finding = SecretDetector.scanLine(secretLine, 12, "config/initializers/stripe.rb");

    expect(finding).toBeDefined();
    expect(finding?.type).toBe("stripe_secret");
    expect(finding?.redactedValue).toBe("[REDACTED_SECRET]");
  });
});
