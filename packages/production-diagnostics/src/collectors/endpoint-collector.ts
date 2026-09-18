import type { Observation } from "../types.js";

export class EndpointCollector {
  private static readonly BLOCKED_METADATA_IPS = [
    "169.254.169.254",
    "metadata.google.internal",
  ];

  public static async probeEndpoint(
    url: string,
    service: string = "web",
    environment: string = "production",
    timeoutMs: number = 3000
  ): Promise<Observation> {
    const trimmed = url.trim();

    for (const blocked of this.BLOCKED_METADATA_IPS) {
      if (trimmed.includes(blocked)) {
        throw new Error(`SSRF violation: Probing cloud metadata address '${url}' is strictly forbidden.`);
      }
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch(trimmed, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timer);

      const durationMs = Date.now() - startTime;
      const isOk = res.status >= 200 && res.status < 400;

      return {
        id: `probe_${Date.now()}`,
        source: "http_probe",
        source_type: "HTTP_PROBE",
        timestamp: new Date().toISOString(),
        severity: isOk ? "INFO" : res.status >= 500 ? "ERROR" : "WARN",
        service,
        environment,
        component: "external_endpoint",
        message: `HTTP GET ${trimmed} returned ${res.status} (${durationMs}ms)`,
        attributes: {
          url: trimmed,
          status_code: res.status,
          duration_ms: durationMs,
        },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      return {
        id: `probe_err_${Date.now()}`,
        source: "http_probe",
        source_type: "HTTP_PROBE",
        timestamp: new Date().toISOString(),
        severity: "ERROR",
        service,
        environment,
        component: "external_endpoint",
        message: `HTTP probe to ${trimmed} failed after ${durationMs}ms: ${err instanceof Error ? err.message : String(err)}`,
        attributes: {
          url: trimmed,
          error: String(err),
          duration_ms: durationMs,
        },
      };
    }
  }
}
