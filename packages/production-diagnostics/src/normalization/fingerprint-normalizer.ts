import { createHash } from "node:crypto";

export class FingerprintNormalizer {
  private static readonly UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  private static readonly HEX_OBJECT_REGEX = /#<[A-Za-z0-9_:]+:0x[0-9a-fA-F]+>/g;
  private static readonly DIGITS_REGEX = /\b\d+\b/g;
  private static readonly QUOTED_STRINGS = /'[^']*'|"[^"]*"/g;

  public static normalizeMessage(message: string): string {
    if (!message) return "";
    let normalized = message;

    normalized = normalized.replace(this.UUID_REGEX, "<UUID>");
    normalized = normalized.replace(this.HEX_OBJECT_REGEX, "<OBJECT>");
    normalized = normalized.replace(this.QUOTED_STRINGS, "<STR>");
    normalized = normalized.replace(this.DIGITS_REGEX, "<NUM>");
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  }

  public static generateFingerprint(exceptionClass: string, message: string, component?: string | undefined): string {
    const normMsg = this.normalizeMessage(message);
    const normClass = exceptionClass ? exceptionClass.trim() : "UnknownError";
    const normComp = component ? component.trim() : "unknown";

    const payload = `${normClass}|${normComp}|${normMsg}`;
    return createHash("sha256").update(payload).digest("hex").substring(0, 16);
  }
}
