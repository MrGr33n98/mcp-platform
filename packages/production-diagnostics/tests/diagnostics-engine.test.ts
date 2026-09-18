import { describe, it, expect } from "vitest";
import { DiagnosticsEngine } from "../src/diagnostics-engine.js";
import { CoverageScanner } from "../src/discovery/coverage-scanner.js";

describe("DiagnosticsEngine General Operation & Coverage Scanner", () => {
  it("handles healthy systems with zero errors smoothly", async () => {
    const result = await DiagnosticsEngine.diagnose({
      environment: "production",
      productName: "oest",
      rawLogs: [
        `[2026-09-17 21:00:00] INFO Started GET "/api/v1/health" for 127.0.0.1`,
        `[2026-09-17 21:00:01] INFO Completed 200 OK in 15ms`,
      ],
    });

    expect(result.incident.status).toBe("RESOLVED");
    expect(result.incident.symptoms.length).toBe(0);
    expect(result.receipt.receipt_type).toBe("DIAGNOSTICS_RECEIPT");
    expect(result.snapshot.observations.length).toBeGreaterThan(0);
  });

  it("CoverageScanner detects repository observability configurations accurately", () => {
    // Test on current mcp-platform directory
    const coverage = CoverageScanner.scanRepository(process.cwd());
    expect(coverage.logs).toBe("AVAILABLE");
    expect(coverage.configured_providers).toBeDefined();
  });
});
