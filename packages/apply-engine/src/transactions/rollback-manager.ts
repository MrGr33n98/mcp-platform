import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { RollbackVerificationReport, WorkspaceSnapshotData } from "../types.js";

export class RollbackManager {
  private static computeFileSha256(content: Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  public static executeRollback(params: {
    workspaceRoot: string;
    snapshot: WorkspaceSnapshotData;
    createdFiles: string[];
    modifiedFiles: string[];
  }): RollbackVerificationReport {
    const rollbackId = `ROLLBACK-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const discrepancies: Array<{ path: string; expected_hash: string | null; actual_hash: string | null; reason: string }> = [];

    let restoredCount = 0;
    let deletedCount = 0;

    // 1. Delete files created by this transaction
    for (const relPath of params.createdFiles) {
      const snap = params.snapshot.files[relPath];
      // Only delete if it did not exist before
      if (snap && !snap.existed_before) {
        const absPath = path.resolve(params.workspaceRoot, relPath);
        if (fs.existsSync(absPath)) {
          try {
            fs.unlinkSync(absPath);
            deletedCount++;
          } catch (err: any) {
            discrepancies.push({
              path: relPath,
              expected_hash: null,
              actual_hash: "EXISTS",
              reason: `Failed to remove created file: ${err.message}`
            });
          }
        }
      }
    }

    // 2. Restore modified files from snapshot
    for (const relPath of params.modifiedFiles) {
      const snap = params.snapshot.files[relPath];
      if (snap && snap.existed_before && snap.content_base64 !== null) {
        const absPath = path.resolve(params.workspaceRoot, relPath);
        try {
          const originalBuffer = Buffer.from(snap.content_base64, "base64");
          fs.writeFileSync(absPath, originalBuffer);
          restoredCount++;
        } catch (err: any) {
          discrepancies.push({
            path: relPath,
            expected_hash: snap.sha256,
            actual_hash: null,
            reason: `Failed to write restored snapshot content: ${err.message}`
          });
        }
      }
    }

    // 3. Rollback Verification Check (Verify byte-for-byte exactness)
    for (const [relPath, snap] of Object.entries(params.snapshot.files)) {
      const absPath = path.resolve(params.workspaceRoot, relPath);
      const exists = fs.existsSync(absPath);

      if (snap.existed_before) {
        if (!exists) {
          discrepancies.push({
            path: relPath,
            expected_hash: snap.sha256,
            actual_hash: null,
            reason: "Pre-existing file is missing after rollback."
          });
        } else {
          const currentBuf = fs.readFileSync(absPath);
          const currentHash = this.computeFileSha256(currentBuf);
          if (currentHash !== snap.sha256) {
            discrepancies.push({
              path: relPath,
              expected_hash: snap.sha256,
              actual_hash: currentHash,
              reason: "Restored file hash mismatch."
            });
          }
        }
      } else {
        if (exists) {
          const currentBuf = fs.readFileSync(absPath);
          const currentHash = this.computeFileSha256(currentBuf);
          discrepancies.push({
            path: relPath,
            expected_hash: null,
            actual_hash: currentHash,
            reason: "Newly created file still exists on disk after rollback."
          });
        }
      }
    }

    const status = discrepancies.length === 0 ? "SUCCESS" : "FAILED";

    return {
      rollback_id: rollbackId,
      transaction_id: params.snapshot.transaction_id,
      restored_at: new Date().toISOString(),
      status,
      files_restored_count: restoredCount,
      files_deleted_count: deletedCount,
      discrepancies
    };
  }
}
