import { createHash } from "node:crypto";
import type { ParsedFileDiff } from "./diff-parser.js";
import type { DiffReport, FileDiffSummary, DiffClassification } from "../types.js";
import { GeneratedFileDetector } from "./generated-file-detector.js";

export class DiffClassifier {
  public static classifyDiff(
    parsedDiffs: ParsedFileDiff[],
    declaredPaths: string[],
    rawDiffText: string
  ): DiffReport {
    const normalizedDeclared = new Set(
      declaredPaths.map(p => p.replace(/\\/g, "/").replace(/^\.\//, "").trim())
    );

    const fileSummaries: FileDiffSummary[] = [];
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    const unexpectedFiles: string[] = [];

    for (const diff of parsedDiffs) {
      const targetPath = diff.isDeleted ? diff.oldPath : diff.newPath;
      const normalizedPath = targetPath.replace(/\\/g, "/").replace(/^\.\//, "").trim();

      let classification: DiffClassification = "EXPECTED";

      if (this.isSensitivePath(normalizedPath)) {
        classification = "SENSITIVE";
        unexpectedFiles.push(normalizedPath);
      } else if (GeneratedFileDetector.isGenerated(normalizedPath)) {
        classification = "GENERATED";
      } else if (normalizedDeclared.has(normalizedPath)) {
        classification = "EXPECTED";
      } else {
        classification = "UNEXPECTED";
        unexpectedFiles.push(normalizedPath);
      }

      const status: "added" | "modified" | "deleted" | "renamed" = diff.isNew
        ? "added"
        : diff.isDeleted
        ? "deleted"
        : "modified";

      fileSummaries.push({
        path: normalizedPath,
        status,
        lines_added: diff.linesAdded,
        lines_removed: diff.linesRemoved,
        classification,
      });

      totalLinesAdded += diff.linesAdded;
      totalLinesRemoved += diff.linesRemoved;
    }

    const diffDigest = createHash("sha256").update(rawDiffText || "").digest("hex");
    const isConsistent = unexpectedFiles.length === 0;

    return {
      files: fileSummaries,
      total_lines_added: totalLinesAdded,
      total_lines_removed: totalLinesRemoved,
      unclassified_or_unexpected: unexpectedFiles,
      is_consistent_with_plan: isConsistent,
      diff_digest: diffDigest,
    };
  }

  private static isSensitivePath(path: string): boolean {
    const lower = path.toLowerCase();
    return (
      lower.includes(".env") ||
      lower.includes("master.key") ||
      lower.includes("credentials.yml.enc") ||
      lower.endsWith(".pem") ||
      lower.endsWith(".key") ||
      lower.includes("id_rsa")
    );
  }
}
