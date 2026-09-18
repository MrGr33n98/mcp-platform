export class SecretRedactor {
  private static readonly SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /sk_live_[a-zA-Z0-9]{20,}/g, replacement: "sk_live_[REDACTED]" },
    { pattern: /gsk_live_[a-zA-Z0-9]{20,}/g, replacement: "gsk_live_[REDACTED]" },
    { pattern: /lsk_live_[a-zA-Z0-9]{20,}/g, replacement: "lsk_live_[REDACTED]" },
    { pattern: /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi, replacement: "Bearer [REDACTED_TOKEN]" },
    { pattern: /password\s*[:=]\s*["']?[^\s"',]+["']?/gi, replacement: "password=[REDACTED]" },
    { pattern: /encrypted_secret\s*[:=]\s*["']?[^\s"',]+["']?/gi, replacement: "encrypted_secret=[REDACTED]" },
    { pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----[^-]+-----END [A-Z ]+ PRIVATE KEY-----/gs, replacement: "[REDACTED_PRIVATE_KEY]" },
    { pattern: /SECRET_KEY_BASE\s*[:=]\s*["']?[a-f0-9]{32,}["']?/gi, replacement: "SECRET_KEY_BASE=[REDACTED]" }
  ];

  public static redact(text: string): string {
    if (!text) return text;
    let redacted = text;
    for (const { pattern, replacement } of this.SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, replacement);
    }
    return redacted;
  }
}
