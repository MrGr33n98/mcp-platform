import { describe, it, expect } from "vitest";
import { DiffParser } from "../src/diff/diff-parser.js";
import { SecretDiffScanner } from "../src/diff/secret-diff-scanner.js";
import { SecretPolicy } from "../src/security/secret-policy.js";
import { CredentialPolicy } from "../src/security/credential-policy.js";

describe("Secret Diff Scanner & Entropy Analysis", () => {
  it("calculates Shannon entropy accurately", () => {
    // Low entropy
    const low = SecretPolicy.calculateShannonEntropy("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(low).toBe(0);

    // Normal English sentence
    const medium = SecretPolicy.calculateShannonEntropy("the quick brown fox jumps over the lazy dog");
    expect(medium).toBeGreaterThan(3.5);
    expect(medium).toBeLessThan(4.5);

    // High entropy random hex/base64 string
    const high = SecretPolicy.calculateShannonEntropy("7f9b8c2d1e0a4f5b6c8d9e0a1b2c3d4e5f6a7b8c");
    expect(high).toBeGreaterThan(3.5);
  });

  it("detects confirmed secrets (AWS, Stripe, Private Keys, Master Key)", () => {
    const fakeStripe = ["sk", "live", "1234567890abcdef1234567890abcdef"].join("_");
    const rawDiff = `
diff --git a/config/initializers/aws.rb b/config/initializers/aws.rb
new file mode 100644
--- /dev/null
+++ b/config/initializers/aws.rb
@@ -0,0 +1,4 @@
+AWS_KEY = "AKIA1234567890ABCDEF"
+STRIPE_KEY = "${fakeStripe}"
+RAILS_MASTER_KEY = "0123456789abcdef0123456789abcdef"
+DB_URL = "postgres://admin:SuperSecretPass123!@db.internal:5432/production"
`;

    const parsed = DiffParser.parse(rawDiff);
    const findings = SecretDiffScanner.scanDiffs(parsed);

    expect(findings.length).toBeGreaterThanOrEqual(4);
    expect(findings.some(f => f.secret_type === "AWS Access Key")).toBe(true);
    expect(findings.some(f => f.secret_type === "Stripe Secret Key")).toBe(true);
    expect(findings.some(f => f.secret_type === "Rails Master Key Assignment")).toBe(true);
    expect(findings.some(f => f.secret_type === "Database URL with Password")).toBe(true);

    // Ensure all secrets are redacted in output
    for (const finding of findings) {
      expect(finding.redacted_fingerprint).toContain("[REDACTED_SECRET:");
      expect(finding.redacted_fingerprint).not.toContain("AKIA1234567890ABCDEF");
      expect(finding.redacted_fingerprint).not.toContain("SuperSecretPass123!");
    }
  });

  it("returns zero findings on clean business code", () => {
    const cleanDiff = `
diff --git a/app/models/webhook_endpoint.rb b/app/models/webhook_endpoint.rb
new file mode 100644
--- /dev/null
+++ b/app/models/webhook_endpoint.rb
@@ -0,0 +1,8 @@
+class WebhookEndpoint < ApplicationRecord
+  belongs_to :enterprise
+  validates :url, presence: true
+  validates :events, presence: true
+end
`;

    const parsed = DiffParser.parse(cleanDiff);
    const findings = SecretDiffScanner.scanDiffs(parsed);
    expect(findings.length).toBe(0);
  });
});
