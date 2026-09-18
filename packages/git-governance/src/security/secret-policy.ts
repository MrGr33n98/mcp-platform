export interface SecretPattern {
  name: string;
  regex: RegExp;
  severity: "CONFIRMED_SECRET" | "LIKELY_SECRET" | "POSSIBLE_SECRET";
}

export class SecretPolicy {
  public static readonly PATTERNS: SecretPattern[] = [
    {
      name: "AWS Access Key",
      regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "Stripe Secret Key",
      regex: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "Stripe Restricted Key",
      regex: /rk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "GitHub Personal Access Token",
      regex: /gh[pousr]_[0-9a-zA-Z]{36}/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "Slack Token",
      regex: /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "RSA/EC/DSA Private Key",
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "Rails Master Key Assignment",
      regex: /(?:RAILS_MASTER_KEY|master_key)\s*[:=]\s*['"]?[a-f0-9]{32}['"]?/gi,
      severity: "CONFIRMED_SECRET",
    },
    {
      name: "Generic API Key Assignment",
      regex: /(?:api_key|apikey|secret_key|app_secret|auth_token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
      severity: "LIKELY_SECRET",
    },
    {
      name: "JWT Token String",
      regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      severity: "LIKELY_SECRET",
    },
    {
      name: "Database URL with Password",
      regex: /(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_-]+:[a-zA-Z0-9_!@#$%^&*()\-+]+@[a-zA-Z0-9._-]+:[0-9]+/g,
      severity: "CONFIRMED_SECRET",
    },
  ];

  /**
   * Calculates Shannon Entropy of a string.
   */
  public static calculateShannonEntropy(str: string): number {
    if (!str || str.length === 0) return 0;
    const freq: Record<string, number> = {};
    for (let i = 0; i < str.length; i++) {
      const char = str[i]!;
      freq[char] = (freq[char] ?? 0) + 1;
    }

    let entropy = 0;
    const len = str.length;
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }
}
