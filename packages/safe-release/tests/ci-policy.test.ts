import { describe, it, expect } from "vitest";
import { CIPolicy } from "../src/ci/ci-policy.js";
import { createValidTestChain } from "./helpers/test-fixtures.js";

describe("CIPolicy", () => {
  it("allows release when all mandatory CI checks pass", () => {
    const { ciReceipt } = createValidTestChain();
    const evaluation = CIPolicy.evaluate(ciReceipt);

    expect(evaluation.allowed).toBe(true);
    expect(evaluation.violations).toHaveLength(0);
  });

  it("blocks when CI overall status is not PASS", () => {
    const { ciReceipt } = createValidTestChain();
    ciReceipt.status = "FAIL";

    const evaluation = CIPolicy.evaluate(ciReceipt);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.violations[0]).toContain("CI_STATUS_NOT_PASS");
  });

  it("blocks when a mandatory check is SKIPPED", () => {
    const { ciReceipt } = createValidTestChain();
    ciReceipt.checks[0]!.status = "SKIPPED";

    const evaluation = CIPolicy.evaluate(ciReceipt);
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.violations.some((v) => v.includes("CRITICAL_CHECK_SKIPPED"))).toBe(true);
  });

  it("blocks when CI run is stale (exceeds TTL)", () => {
    const { ciReceipt } = createValidTestChain();
    // Finished 48 hours ago
    ciReceipt.finished_at = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const evaluation = CIPolicy.evaluate(ciReceipt, { maxAgeHours: 24 });
    expect(evaluation.allowed).toBe(false);
    expect(evaluation.violations.some((v) => v.includes("STALE_CI_RUN"))).toBe(true);
  });
});
