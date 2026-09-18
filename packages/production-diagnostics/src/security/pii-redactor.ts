export class PIIRedactor {
  private static readonly EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  private static readonly IP_REGEX = /\b(?:(?!127\.0\.0\.1|0\.0\.0\.0)(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;
  private static readonly PHONE_REGEX = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/g;
  private static readonly CPF_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;

  public static redact(text: string): string {
    if (!text) return text;
    let sanitized = text;

    sanitized = sanitized.replace(this.EMAIL_REGEX, "[REDACTED_EMAIL]");
    sanitized = sanitized.replace(this.CPF_REGEX, "[REDACTED_CPF]");
    sanitized = sanitized.replace(this.IP_REGEX, "[REDACTED_IP]");

    return sanitized;
  }
}
