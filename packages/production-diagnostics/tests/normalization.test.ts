import { describe, it, expect } from "vitest";
import { TimestampNormalizer } from "../src/normalization/timestamp-normalizer.js";
import { SeverityNormalizer } from "../src/normalization/severity-normalizer.js";
import { FingerprintNormalizer } from "../src/normalization/fingerprint-normalizer.js";
import { EventNormalizer } from "../src/normalization/event-normalizer.js";

describe("Normalization & Fingerprinting", () => {
  it("normalizes various timestamp representations to valid ISO-8601", () => {
    const iso = TimestampNormalizer.normalize("2026-09-17T20:00:00Z");
    expect(iso).toBe("2026-09-17T20:00:00.000Z");

    const epochMs = TimestampNormalizer.normalize(1726610400000);
    expect(epochMs).toContain("2024-09-17");

    const railsLogTime = TimestampNormalizer.normalize("[2026-09-17 21:00:00]");
    expect(railsLogTime).toContain("2026-09-17T21:00:00");
  });

  it("normalizes severities according to log levels and HTTP status codes", () => {
    expect(SeverityNormalizer.normalize("FATAL")).toBe("CRITICAL");
    expect(SeverityNormalizer.normalize("ERROR")).toBe("ERROR");
    expect(SeverityNormalizer.normalize("WARN")).toBe("WARN");
    expect(SeverityNormalizer.normalize("INFO")).toBe("INFO");

    expect(SeverityNormalizer.normalize(undefined, 500)).toBe("ERROR");
    expect(SeverityNormalizer.normalize(undefined, 404)).toBe("WARN");
    expect(SeverityNormalizer.normalize(undefined, 200)).toBe("INFO");
  });

  it("generates deterministic error fingerprints stripping variable UUIDs and numbers", () => {
    const msg1 = "ActiveRecord::RecordNotFound: Couldn't find Mission with 'id'=12345 (UUID: a81c29e4-4b5c-4d3e-9f1a-8b2c3d4e5f6a)";
    const msg2 = "ActiveRecord::RecordNotFound: Couldn't find Mission with 'id'=99999 (UUID: b92d30f5-5c6d-5e4f-0a2b-9c3d4e5f6a7b)";

    const fp1 = FingerprintNormalizer.generateFingerprint("ActiveRecord::RecordNotFound", msg1, "MissionsController");
    const fp2 = FingerprintNormalizer.generateFingerprint("ActiveRecord::RecordNotFound", msg2, "MissionsController");

    expect(fp1).toBe(fp2);
  });

  it("EventNormalizer parses structured JSON logs and extracts request_id", () => {
    const jsonLog = JSON.stringify({
      timestamp: "2026-09-17T21:30:00Z",
      level: "ERROR",
      message: "Delivery failed",
      request_id: "a81c29e4-4b5c-4d3e-9f1a-8b2c3d4e5f6a",
      component: "WebhookDeliveryJob",
    });

    const obs = EventNormalizer.normalizeLogLine(jsonLog);
    expect(obs.severity).toBe("ERROR");
    expect(obs.request_id).toBe("a81c29e4-4b5c-4d3e-9f1a-8b2c3d4e5f6a");
    expect(obs.component).toBe("WebhookDeliveryJob");
    expect(obs.source_type).toBe("LOG");
  });
});
