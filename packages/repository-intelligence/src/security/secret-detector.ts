import type { SecretFinding } from "../types.js";

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /jwt[_-]?secret/i,
  /stripe[_-]?(?:secret|key)/i,
  /private[_-]?key/i,
  /auth[_-]?token/i
];

export class SecretDetector {
  public static scanLine(line: string, lineNum: number, filePath: string): SecretFinding | null {
    for (const pattern of SENSITIVE_KEY_PATTERNS) {
      if (pattern.test(line)) {
        const match = line.match(/(?:[A-Z0-9_]+)\s*[:=]\s*["']?([^"'\s]{8,})["']?/i);
        const secretVal = match?.[1];
        if (secretVal && !secretVal.startsWith("<") && !secretVal.startsWith("ENV[")) {
          const varMatch = line.match(/([A-Za-z0-9_]+)\s*[:=]/);
          const varName = varMatch?.[1] ?? "SENSITIVE_VAR";
          
          return {
            file: filePath,
            line: lineNum,
            variableName: varName,
            type: this.classifySecret(varName),
            redactedValue: "[REDACTED_SECRET]"
          };
        }
      }
    }
    return null;
  }

  private static classifySecret(varName: string): SecretFinding["type"] {
    const lower = varName.toLowerCase();
    if (lower.includes("stripe")) return "stripe_secret";
    if (lower.includes("jwt")) return "jwt_secret";
    if (lower.includes("db") || lower.includes("database_url")) return "database_url";
    if (lower.includes("private") || lower.includes("rsa")) return "private_key";
    return "api_key";
  }
}
