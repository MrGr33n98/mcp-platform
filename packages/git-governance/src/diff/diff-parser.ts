export interface ParsedFileDiff {
  oldPath: string;
  newPath: string;
  isNew: boolean;
  isDeleted: boolean;
  linesAdded: number;
  linesRemoved: number;
  addedLines: Array<{ lineNumber: number; content: string }>;
}

export class DiffParser {
  public static parse(unifiedDiff: string): ParsedFileDiff[] {
    if (!unifiedDiff || !unifiedDiff.trim()) {
      return [];
    }

    const files: ParsedFileDiff[] = [];
    const fileChunks = unifiedDiff.split(/^diff --git /m).filter(c => c.trim().length > 0);

    for (const chunk of fileChunks) {
      const lines = chunk.split(/\r?\n/);
      const firstLine = lines[0] || "";
      const match = firstLine.match(/a\/(.+?)\s+b\/(.+)$/);

      let oldPath = match ? match[1]! : "unknown";
      let newPath = match ? match[2]! : "unknown";
      let isNew = false;
      let isDeleted = false;
      let linesAdded = 0;
      let linesRemoved = 0;
      const addedLines: Array<{ lineNumber: number; content: string }> = [];

      let currentLineNum = 0;

      for (const line of lines) {
        if (line.startsWith("new file mode")) {
          isNew = true;
        } else if (line.startsWith("deleted file mode")) {
          isDeleted = true;
        } else if (line.startsWith("--- ")) {
          if (line.includes("/dev/null")) isNew = true;
        } else if (line.startsWith("+++ ")) {
          if (line.includes("/dev/null")) isDeleted = true;
          const pMatch = line.match(/^\+\+\+ b\/(.+)$/);
          if (pMatch) newPath = pMatch[1]!;
        } else if (line.startsWith("@@ ")) {
          const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
          if (hunkMatch) {
            currentLineNum = parseInt(hunkMatch[1]!, 10);
          }
        } else if (line.startsWith("+") && !line.startsWith("+++")) {
          linesAdded++;
          addedLines.push({
            lineNumber: currentLineNum,
            content: line.substring(1),
          });
          currentLineNum++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          linesRemoved++;
        } else if (!line.startsWith("\\")) {
          currentLineNum++;
        }
      }

      files.push({
        oldPath: oldPath.replace(/\\/g, "/"),
        newPath: newPath.replace(/\\/g, "/"),
        isNew,
        isDeleted,
        linesAdded,
        linesRemoved,
        addedLines,
      });
    }

    return files;
  }
}
