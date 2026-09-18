import { createHash } from "node:crypto";
import type { Observation, ObservationSeverity, ObservationSourceType } from "../types.js";
import { TimestampNormalizer } from "./timestamp-normalizer.js";
import { SeverityNormalizer } from "./severity-normalizer.js";
import { FingerprintNormalizer } from "./fingerprint-normalizer.js";
import { SecretRedactor } from "../security/secret-redactor.js";
import { PIIRedactor } from "../security/pii-redactor.js";

export class EventNormalizer {
  public static normalizeLogLine(rawLine: string, service: string = "web", environment: string = "production"): Observation {
    const sanitizedRaw = PIIRedactor.redact(SecretRedactor.redact(rawLine));

    // Try parsing structured JSON log
    let parsedJson: Record<string, unknown> | null = null;
    try {
      if (sanitizedRaw.trim().startsWith("{") && sanitizedRaw.trim().endsWith("}")) {
        parsedJson = JSON.parse(sanitizedRaw) as Record<string, unknown>;
      }
    } catch {
      // Plain text log
    }

    const id = `obs_${createHash("sha256").update(sanitizedRaw).digest("hex").substring(0, 12)}`;
    let timestamp = new Date().toISOString();
    let severity: ObservationSeverity = "INFO";
    let component = "app";
    let message = sanitizedRaw;
    let requestId: string | undefined = undefined;
    let traceId: string | undefined = undefined;
    let deploymentId: string | undefined = undefined;

    if (parsedJson) {
      timestamp = TimestampNormalizer.normalize(parsedJson.timestamp || parsedJson.time || parsedJson["@timestamp"]);
      const rawStatus = typeof parsedJson.status === "number" ? parsedJson.status : undefined;
      severity = SeverityNormalizer.normalize(parsedJson.level || parsedJson.severity, rawStatus);
      message = String(parsedJson.message || parsedJson.msg || sanitizedRaw);
      component = String(parsedJson.component || parsedJson.controller || parsedJson.service || "app");
      requestId = parsedJson.request_id ? String(parsedJson.request_id) : undefined;
      traceId = parsedJson.trace_id ? String(parsedJson.trace_id) : undefined;
      deploymentId = parsedJson.deployment_id ? String(parsedJson.deployment_id) : undefined;
    } else {
      // Regex extraction for typical Rails log: [request_id] Method /path (Controller#action)
      const reqMatch = sanitizedRaw.match(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i);
      if (reqMatch) {
        requestId = reqMatch[1];
      }

      const ctrlMatch = sanitizedRaw.match(/Processing by ([A-Za-z0-9_:]+#[A-Za-z0-9_]+)/);
      if (ctrlMatch) {
        component = ctrlMatch[1]!;
      }

      if (/FATAL|CRITICAL/i.test(sanitizedRaw)) severity = "CRITICAL";
      else if (/ERROR|Completed 500/i.test(sanitizedRaw)) severity = "ERROR";
      else if (/WARN|Completed 4/i.test(sanitizedRaw)) severity = "WARN";
    }

    const fingerprint = FingerprintNormalizer.generateFingerprint("LogEntry", message, component);

    return {
      id,
      source: "log_stream",
      source_type: "LOG",
      timestamp,
      severity,
      service,
      environment,
      component,
      message,
      ...(requestId ? { request_id: requestId } : {}),
      ...(traceId ? { trace_id: traceId } : {}),
      ...(deploymentId ? { deployment_id: deploymentId } : {}),
      fingerprint,
      attributes: parsedJson || {},
      raw_excerpt: sanitizedRaw.substring(0, 500),
    };
  }

  public static normalizeErrorObject(
    rawError: Record<string, unknown>,
    service: string = "web",
    environment: string = "production"
  ): Observation {
    const errClass = String(rawError.exception_class || rawError.error_class || rawError.name || "RuntimeError");
    const rawMsg = String(rawError.message || rawError.error_message || "");
    const sanitizedMsg = PIIRedactor.redact(SecretRedactor.redact(rawMsg));
    const component = String(rawError.component || rawError.controller || rawError.job_class || "app");
    const timestamp = TimestampNormalizer.normalize(rawError.timestamp || rawError.time);

    const fingerprint = FingerprintNormalizer.generateFingerprint(errClass, sanitizedMsg, component);
    const id = `err_${fingerprint}_${Date.now()}`;

    return {
      id,
      source: String(rawError.source || "error_tracker"),
      source_type: "ERROR_TRACKER",
      timestamp,
      severity: "ERROR",
      service,
      environment,
      component,
      message: `${errClass}: ${sanitizedMsg}`,
      ...(rawError.request_id ? { request_id: String(rawError.request_id) } : {}),
      ...(rawError.trace_id ? { trace_id: String(rawError.trace_id) } : {}),
      fingerprint,
      attributes: rawError,
      raw_excerpt: sanitizedMsg.substring(0, 500),
    };
  }
}
