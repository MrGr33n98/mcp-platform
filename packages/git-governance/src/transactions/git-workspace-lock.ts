import * as fs from "node:fs";
import * as path from "node:path";

export interface LockMetadata {
  lock_id: string;
  operation_id: string;
  created_at: string;
  pid: number;
}

export class GitWorkspaceLock {
  private lockFilePath: string;
  private isHeld: boolean = false;

  constructor(private readonly workspaceRoot: string) {
    this.lockFilePath = path.join(this.workspaceRoot, ".git_gov_lock");
  }

  public acquire(operationId: string, timeoutMs: number = 5000): void {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (!fs.existsSync(this.lockFilePath)) {
        const meta: LockMetadata = {
          lock_id: `lock_${Date.now()}`,
          operation_id: operationId,
          created_at: new Date().toISOString(),
          pid: process.pid,
        };
        try {
          fs.writeFileSync(this.lockFilePath, JSON.stringify(meta, null, 2), { flag: "wx" });
          this.isHeld = true;
          return;
        } catch {
          // Race condition, retry
        }
      } else {
        // Check for stale lock (> 10 mins old)
        try {
          const content = fs.readFileSync(this.lockFilePath, "utf8");
          const meta = JSON.parse(content) as LockMetadata;
          const lockTime = new Date(meta.created_at).getTime();
          if (Date.now() - lockTime > 10 * 60 * 1000) {
            fs.unlinkSync(this.lockFilePath);
            continue;
          }
        } catch {
          // Ignore parse errors, retry
        }
      }

      // Busy-wait loop sleep simulation
      const end = Date.now() + 50;
      while (Date.now() < end) {
        // spin
      }
    }

    throw new Error(
      `Failed to acquire Git governance lock on workspace '${this.workspaceRoot}' after ${timeoutMs}ms. Another operation may be in progress.`
    );
  }

  public release(): void {
    if (this.isHeld && fs.existsSync(this.lockFilePath)) {
      try {
        fs.unlinkSync(this.lockFilePath);
      } catch {
        // Ignore unlink error
      }
      this.isHeld = false;
    }
  }
}
