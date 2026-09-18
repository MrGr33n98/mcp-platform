import fs from "fs";
import path from "path";
import type { JournalStatus, MutationJournal, MutationJournalEntry, MutationType } from "../types.js";

export class MutationJournalManager {
  private static readonly JOURNAL_BASE_DIR = ".apply_journals";

  public static initJournal(workspaceRoot: string, transactionId: string): MutationJournal {
    const journalDir = path.join(workspaceRoot, this.JOURNAL_BASE_DIR);
    if (!fs.existsSync(journalDir)) {
      fs.mkdirSync(journalDir, { recursive: true });
    }

    const journal: MutationJournal = {
      transaction_id: transactionId,
      started_at: new Date().toISOString(),
      entries: []
    };

    this.saveJournal(workspaceRoot, journal);
    return journal;
  }

  public static appendEntry(
    workspaceRoot: string,
    journal: MutationJournal,
    entry: {
      operation_id: string;
      mutation_type: MutationType;
      path: string;
      before_hash: string | null;
      after_hash: string | null;
      status: JournalStatus;
      error?: string | undefined;
    }
  ): MutationJournalEntry {
    const fullEntry: MutationJournalEntry = {
      sequence: journal.entries.length + 1,
      operation_id: entry.operation_id,
      mutation_type: entry.mutation_type,
      path: entry.path,
      before_hash: entry.before_hash,
      after_hash: entry.after_hash,
      status: entry.status,
      timestamp: new Date().toISOString(),
      error: entry.error
    };

    journal.entries.push(fullEntry);
    this.saveJournal(workspaceRoot, journal);
    return fullEntry;
  }

  public static finalizeJournal(workspaceRoot: string, journal: MutationJournal): void {
    journal.completed_at = new Date().toISOString();
    this.saveJournal(workspaceRoot, journal);
  }

  private static saveJournal(workspaceRoot: string, journal: MutationJournal): void {
    const journalPath = path.join(workspaceRoot, this.JOURNAL_BASE_DIR, `${journal.transaction_id}.json`);
    fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2), "utf-8");
  }

  public static readIncompleteJournal(workspaceRoot: string): MutationJournal | null {
    const journalDir = path.join(workspaceRoot, this.JOURNAL_BASE_DIR);
    if (!fs.existsSync(journalDir)) return null;

    const files = fs.readdirSync(journalDir).filter((f: string) => f.endsWith(".json"));
    for (const f of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(journalDir, f), "utf-8")) as MutationJournal;
        if (!content.completed_at) {
          return content;
        }
      } catch {}
    }
    return null;
  }
}
