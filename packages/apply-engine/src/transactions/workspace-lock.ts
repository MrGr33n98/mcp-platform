import fs from "fs";
import path from "path";

export class WorkspaceLock {
  private static readonly LOCK_FILENAME = ".apply_lock";
  private static readonly LOCK_STALE_MS = 60000; // 60s timeout for stale crash lock

  public static acquire(workspaceRoot: string, transactionId: string): { acquired: boolean; reason?: string } {
    const lockPath = path.join(workspaceRoot, this.LOCK_FILENAME);

    if (fs.existsSync(lockPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
        const age = Date.now() - new Date(content.acquired_at).getTime();

        if (age < this.LOCK_STALE_MS) {
          return {
            acquired: false,
            reason: `Workspace is locked by active transaction '${content.transaction_id}' (PID ${content.pid}) acquired at ${content.acquired_at}. Concurrent applies are forbidden.`
          };
        }
        // Stale lock detected, can release
        fs.unlinkSync(lockPath);
      } catch {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      }
    }

    try {
      const lockData = {
        transaction_id: transactionId,
        pid: process.pid,
        acquired_at: new Date().toISOString()
      };
      fs.writeFileSync(lockPath, JSON.stringify(lockData, null, 2), "utf-8");
      return { acquired: true };
    } catch (err: any) {
      return { acquired: false, reason: `Failed to acquire workspace lock: ${err.message}` };
    }
  }

  public static release(workspaceRoot: string, transactionId: string): void {
    const lockPath = path.join(workspaceRoot, this.LOCK_FILENAME);
    if (fs.existsSync(lockPath)) {
      try {
        const content = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
        if (content.transaction_id === transactionId) {
          fs.unlinkSync(lockPath);
        }
      } catch {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      }
    }
  }
}
