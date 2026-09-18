import { SecretRedactor } from "./secret-redactor.js";

export class OutputSanitizer {
  private static readonly MAX_OUTPUT_LENGTH = 100_000; // 100 KB
  private static readonly ANSI_ESCAPE_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

  public static sanitize(rawOutput: string): string {
    if (!rawOutput) return "";

    // 1. Strip ANSI escape codes
    let sanitized = rawOutput.replace(this.ANSI_ESCAPE_REGEX, "");

    // 2. Redact sensitive secrets
    sanitized = SecretRedactor.redact(sanitized);

    // 3. Truncate if exceeds max length
    if (sanitized.length > this.MAX_OUTPUT_LENGTH) {
      sanitized = sanitized.slice(0, this.MAX_OUTPUT_LENGTH) + "\n\n[OUTPUT TRUNCATED BY OUTPUT SANITIZER]";
    }

    return sanitized;
  }
}
