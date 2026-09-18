import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import type { FileSnapshot, WorkspaceSnapshotData } from "../types.js";

export class WorkspaceSnapshotManager {
  private static readonly SNAPSHOT_BASE_DIR = ".apply_snapshots";

  public static computeFileSha256(content: Buffer): string {
    return createHash("sha256").update(content).digest("hex");
  }

  public static createSnapshot(params: {
    workspaceRoot: string;
    transactionId: string;
    targetPaths: string[];
  }): WorkspaceSnapshotData {
    const snapshotDir = path.join(params.workspaceRoot, this.SNAPSHOT_BASE_DIR, params.transactionId);
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    const files: Record<string, FileSnapshot> = {};

    for (const relPath of params.targetPaths) {
      const absPath = path.resolve(params.workspaceRoot, relPath);
      const exists = fs.existsSync(absPath);

      if (exists) {
        const rawContent = fs.readFileSync(absPath);
        const hash = this.computeFileSha256(rawContent);
        const backupPath = path.join(snapshotDir, relPath.replace(/[\/\\]/g, "_") + ".bak");

        fs.writeFileSync(backupPath, rawContent);

        files[relPath] = {
          relative_path: relPath,
          absolute_path: absPath,
          existed_before: true,
          content_base64: rawContent.toString("base64"),
          sha256: hash,
          size_bytes: rawContent.length
        };
      } else {
        files[relPath] = {
          relative_path: relPath,
          absolute_path: absPath,
          existed_before: false,
          content_base64: null,
          sha256: null,
          size_bytes: 0
        };
      }
    }

    const snapshotData: WorkspaceSnapshotData = {
      transaction_id: params.transactionId,
      created_at: new Date().toISOString(),
      workspace_root: params.workspaceRoot,
      files
    };

    const metaPath = path.join(snapshotDir, "snapshot_metadata.json");
    fs.writeFileSync(metaPath, JSON.stringify(snapshotData, null, 2), "utf-8");

    return snapshotData;
  }

  public static cleanSnapshot(workspaceRoot: string, transactionId: string): void {
    const snapshotDir = path.join(workspaceRoot, this.SNAPSHOT_BASE_DIR, transactionId);
    if (fs.existsSync(snapshotDir)) {
      try {
        fs.rmSync(snapshotDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
