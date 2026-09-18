import type { ParsedFileDiff } from "./diff-parser.js";
import type { SecretFinding } from "../types.js";
import { SecretPolicy } from "../security/secret-policy.js";
import { CredentialPolicy } from "../security/credential-policy.js";

export class SecretDiffScanner {
  private static readonly HIGH_ENTROPY_THRESHOLD = 4.5;
  private static readonly MIN_ENTROPY_STRING_LEN = 24;

  public static scanDiffs(parsedDiffs: ParsedFileDiff[]): SecretFinding[] {
    const findings: SecretFinding[] = [];

    for (const diff of parsedDiffs) {
      const filePath = diff.newPath;

      for (const added of diff.addedLines) {
        const lineContent = added.content;

        // 1. Pattern Matching
        for (const pattern of SecretPolicy.PATTERNS) {
          // Reset regex state
          pattern.regex.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = pattern.regex.exec(lineContent)) !== null) {
            const rawSecret = match[0];
            findings.push({
              file: filePath,
              line: added.lineNumber,
              secret_type: pattern.name,
              severity: pattern.severity,
              redacted_fingerprint: CredentialPolicy.redactFingerprint(rawSecret),
            });
          }
        }

        // 2. High Entropy Heuristic for tokens/hashes
        const words = lineContent.split(/[\s"',;:=(){}\[\]]+/);
        for (const word of words) {
          if (word.length >= this.MIN_ENTROPY_STRING_LEN) {
            // Avoid flagging typical base64 image prefixes or standard long path names with no symbols
            if (word.startsWith("data:image") || word.startsWith("http://") || word.startsWith("https://")) {
              continue;
            }

            const entropy = SecretPolicy.calculateShannonEntropy(word);
            if (entropy >= this.HIGH_ENTROPY_THRESHOLD) {
              // Check if already caught by pattern match on this line
              const alreadyFound = findings.some(
                f => f.file === filePath && f.line === added.lineNumber && f.secret_type !== "High Entropy Heuristic"
              );

              if (!alreadyFound) {
                findings.push({
                  file: filePath,
                  line: added.lineNumber,
                  secret_type: `High Entropy String (entropy=${entropy.toFixed(2)})`,
                  severity: entropy >= 4.8 ? "CONFIRMED_SECRET" : "LIKELY_SECRET",
                  redacted_fingerprint: CredentialPolicy.redactFingerprint(word),
                });
              }
            }
          }
        }
      }
    }

    return findings;
  }
}
