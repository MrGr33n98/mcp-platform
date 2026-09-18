import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { WorkspaceSnapshotManager } from "../src/transactions/workspace-snapshot.js";
import { RollbackManager } from "../src/transactions/rollback-manager.js";

describe("Transactions & Rollback Engine (Phase 5G)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-apply-rollback-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("creates byte-exact snapshots and restores files on rollback with zero discrepancies", () => {
    const originalFilePath = path.join(tempDir, "existing_model.rb");
    const originalContent = "# original human code\nclass User < ApplicationRecord\nend\n";
    fs.writeFileSync(originalFilePath, originalContent, "utf-8");

    const newFilePath = path.join(tempDir, "new_webhook.rb");

    const txId = "TX-TEST-ROLLBACK-001";
    const targetPaths = ["existing_model.rb", "new_webhook.rb"];

    // 1. Snapshot
    const snapshot = WorkspaceSnapshotManager.createSnapshot({
      workspaceRoot: tempDir,
      transactionId: txId,
      targetPaths
    });

    expect(snapshot.files["existing_model.rb"].existed_before).toBe(true);
    expect(snapshot.files["new_webhook.rb"].existed_before).toBe(false);

    // 2. Perform mutations (modify existing, create new)
    fs.writeFileSync(originalFilePath, "# corrupted/modified content\n", "utf-8");
    fs.writeFileSync(newFilePath, "class NewWebhook; end\n", "utf-8");

    // 3. Rollback
    const rollbackReport = RollbackManager.executeRollback({
      workspaceRoot: tempDir,
      snapshot,
      createdFiles: ["new_webhook.rb"],
      modifiedFiles: ["existing_model.rb"]
    });

    // 4. Verify Rollback Report
    expect(rollbackReport.status).toBe("SUCCESS");
    expect(rollbackReport.files_restored_count).toBe(1);
    expect(rollbackReport.files_deleted_count).toBe(1);
    expect(rollbackReport.discrepancies.length).toBe(0);

    // 5. Verify filesystem status
    expect(fs.existsSync(newFilePath)).toBe(false);
    expect(fs.readFileSync(originalFilePath, "utf-8")).toBe(originalContent);
  });
});
