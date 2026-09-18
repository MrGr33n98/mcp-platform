import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { WorkspaceLock } from "../src/transactions/workspace-lock.js";

describe("Concurrency & Workspace Lock (Phase 5G)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-apply-lock-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("prevents concurrent transactions on the same workspace", () => {
    const tx1 = "TX-001";
    const tx2 = "TX-002";

    const lock1 = WorkspaceLock.acquire(tempDir, tx1);
    expect(lock1.acquired).toBe(true);

    const lock2 = WorkspaceLock.acquire(tempDir, tx2);
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain("locked by active transaction 'TX-001'");

    WorkspaceLock.release(tempDir, tx1);

    const lock2Retry = WorkspaceLock.acquire(tempDir, tx2);
    expect(lock2Retry.acquired).toBe(true);

    WorkspaceLock.release(tempDir, tx2);
  });
});
