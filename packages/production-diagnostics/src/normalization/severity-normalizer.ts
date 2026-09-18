import type { ObservationSeverity } from "../types.js";

export class SeverityNormalizer {
  public static normalize(rawLevel: unknown, statusCode?: number | undefined): ObservationSeverity {
    if (typeof statusCode === "number") {
      if (statusCode >= 500) return "ERROR";
      if (statusCode >= 400) return "WARN";
      return "INFO";
    }

    if (typeof rawLevel === "string") {
      const upper = rawLevel.trim().toUpperCase();
      if (upper === "FATAL" || upper === "CRITICAL" || upper === "EMERGENCY") return "CRITICAL";
      if (upper === "ERROR" || upper === "ERR" || upper === "EXCEPTION") return "ERROR";
      if (upper === "WARN" || upper === "WARNING") return "WARN";
      if (upper === "INFO" || upper === "DEBUG" || upper === "TRACE" || upper === "NOTICE") return "INFO";
    }

    return "INFO";
  }
}
