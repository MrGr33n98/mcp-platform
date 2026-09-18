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
}
