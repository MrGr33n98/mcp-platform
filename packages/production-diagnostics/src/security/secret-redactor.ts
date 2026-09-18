export class SecretRedactor {
  private static readonly SECRET_PATTERNS: Array<{ name: string; regex: RegExp; replace: string }> = [
    {
      name: "Authorization Header",
      regex: /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi,
      replace: "Bearer [REDACTED_TOKEN]",
    },
    {
      name: "Basic Auth Header",
      regex: /Basic\s+[a-zA-Z0-9=+/]{15,}/gi,
      replace: "Basic [REDACTED_BASIC_AUTH]",
    },
    {
      name: "AWS Key",
      regex: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
      replace: "[REDACTED_AWS_KEY]",
    },
    {
      name: "Stripe Key",
      regex: /(?:sk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
      replace: "[REDACTED_STRIPE_KEY]",
    },
    {
      name: "GitHub Token",
      regex: /gh[pousr]_[0-9a-zA-Z]{36}/g,
      replace: "[REDACTED_GITHUB_TOKEN]",
    },
    {
      name: "Private Key",
      regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
      replace: "[REDACTED_PRIVATE_KEY_BLOCK]",
    },
    {
      name: "Rails Master Key",
      regex: /(?:RAILS_MASTER_KEY|master_key)\s*[:=]\s*['"]?[a-f0-9]{32}['"]?/gi,
      replace: "RAILS_MASTER_KEY=[REDACTED_MASTER_KEY]",
    },
    {
      name: "Database URL",
      regex: /(?:postgres|mysql|mongodb|redis):\/\/[a-zA-Z0-9_-]+:[^@\s]+@([a-zA-Z0-9._-]+:[0-9]+)/gi,
      replace: "protocol://[REDACTED_USER]:[REDACTED_PASSWORD]@$1",
    },
    {
      name: "JWT Token",
      regex: /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
      replace: "[REDACTED_JWT_TOKEN]",
    },
  ];

  public static redact(text: string): string {
    if (!text) return text;
    let sanitized = text;

    for (const pattern of this.SECRET_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replace);
    }

    return sanitized;
  }
}
