const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /credential/i,
  /private[_-]?key/i,
  /auth/i,
  /ssh/i
];

export class CredentialIsolationPolicy {
  public static sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))) {
        sanitized[key] = "[REDACTED_CREDENTIAL]";
      } else if (typeof value === "object" && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  public static assertNoCredentialsInPayload(obj: unknown, path = "root"): void {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))) {
        if (typeof value === "string" && value.length > 0 && value !== "[REDACTED_CREDENTIAL]") {
          throw new Error(
            `CREDENTIAL_EXPOSURE_DETECTED: Sensitive key '${path}.${key}' contains an unredacted credential value.`
          );
        }
      }
      if (typeof value === "object" && value !== null) {
        this.assertNoCredentialsInPayload(value, `${path}.${key}`);
      }
    }
  }
}
