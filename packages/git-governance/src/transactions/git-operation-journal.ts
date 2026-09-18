import * as fs from "node:fs";
import * as path from "node:path";
import type { GitOperationJournal, GitOperationJournalEntry, GitStatus } from "../types.js";

export class GitOperationJournalManager {
  private journalDir: string;
  private journalFile: string;
  private journal: GitOperationJournal;
  private sequenceCounter: number = 0;

  constructor(private readonly workspaceRoot: string, private readonly operationId: string) {
    this.journalDir = path.join(this.workspaceRoot, ".git_gov_journals");
    this.journalFile = path.join(this.journalDir, `${operationId}.json`);
    this.journal = {
      operation_id: operationId,
      started_at: new Date().toISOString(),
      entries: [],
    };
  }

  public record(status: GitStatus, detail: string, error?: string | undefined): void {
    this.sequenceCounter++;
    const entry: GitOperationJournalEntry = {
      sequence: this.sequenceCounter,
      status,
      detail,
      timestamp: new Date().toISOString(),
      ...(error ? { error } : {}),
    };

    this.journal.entries.push(entry);
    this.flush();
  }

  public complete(): void {
    this.journal.completed_at = new Date().toISOString();
    this.flush();
  }

  public getJournal(): GitOperationJournal {
    return this.journal;
  }

  public static checkIncompleteOperations(workspaceRoot: string, currentOperationId: string): string[] {
    const journalDir = path.join(workspaceRoot, ".git_gov_journals");
    if (!fs.existsSync(journalDir)) return [];

    const files = fs.readdirSync(journalDir);
    const incompleteOps: string[] = [];

    for (const file of files) {
      if (file.endsWith(".json") && !file.startsWith(currentOperationId)) {
        try {
          const content = fs.readFileSync(path.join(journalDir, file), "utf8");
          const data = JSON.parse(content) as GitOperationJournal;
          if (!data.completed_at) {
            const lastEntry = data.entries[data.entries.length - 1];
            if (lastEntry && lastEntry.status !== "COMMITTED" && lastEntry.status !== "FAILED") {
              incompleteOps.push(data.operation_id);
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    return incompleteOps;
  }

  private flush(): void {
    if (!fs.existsSync(this.journalDir)) {
      fs.mkdirSync(this.journalDir, { recursive: true });
    }
    fs.writeFileSync(this.journalFile, JSON.stringify(this.journal, null, 2), "utf8");
  }
}
