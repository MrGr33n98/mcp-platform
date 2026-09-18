import { createHash } from "node:crypto";

export class CredentialPolicy {
  public static redactFingerprint(secret: string): string {
    if (!secret || secret.length === 0) {
      return "[EMPTY]";
    }

    const sha = createHash("sha256").update(secret).digest("hex").substring(0, 10);
    const prefix = secret.length > 8 ? secret.substring(0, 4) : "...";
    const suffix = secret.length > 8 ? secret.substring(secret.length - 3) : "...";

    return `[REDACTED_SECRET:${prefix}...${suffix}:sha256_${sha}]`;
  }

  public static sanitizeString(text: string): string {
    if (!text) return text;
    // Redact typical Bearer and Basic headers or passwords in URLs
    let sanitized = text.replace(/Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi, "Bearer [REDACTED_TOKEN]");
    sanitized = sanitized.replace(/(https?:\/\/[^:]+):([^@]+)@/g, "$1:[REDACTED_PASSWORD]@");
    return sanitized;
  }
}
