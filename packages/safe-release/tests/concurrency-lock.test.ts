import { describe, it, expect, beforeEach } from "vitest";
import { ReleaseLock } from "../src/deployment/deployment-controller.js";

describe("ReleaseLock — Concurrency Control", () => {
  beforeEach(() => {
    ReleaseLock.resetAll();
  });

  it("prevents concurrent release mutations on the same product and environment", () => {
    const lock1 = ReleaseLock.acquire("oest", "PRODUCTION", "release-001");
    expect(lock1).toBe(true);

    // Tentativa simultânea com release diferente
    const lock2 = ReleaseLock.acquire("oest", "PRODUCTION", "release-002");
    expect(lock2).toBe(false);

    // Permite lock em produto diferente
    const lockAvalia = ReleaseLock.acquire("avalia", "PRODUCTION", "release-003");
    expect(lockAvalia).toBe(true);

    // Libera o primeiro lock
    ReleaseLock.release("oest", "PRODUCTION", "release-001");

    // Agora release-002 pode adquirir
    const lock2After = ReleaseLock.acquire("oest", "PRODUCTION", "release-002");
    expect(lock2After).toBe(true);
  });
});
