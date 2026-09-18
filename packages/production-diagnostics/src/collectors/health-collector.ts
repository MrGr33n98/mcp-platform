import type { Observation } from "../types.js";

export class HealthCollector {
  public static async collect(
    healthChecker?: (() => Promise<Record<string, unknown>>) | undefined
  ): Promise<Observation[]> {
    if (!healthChecker) return [];

    try {
      const data = await healthChecker();
      const isOk = data.status === "ok" || data.status === "healthy" || data.healthy === true;

      return [
        {
          id: `health_${Date.now()}`,
          source: "health_check",
          source_type: "HEALTH_CHECK",
          timestamp: new Date().toISOString(),
          severity: isOk ? "INFO" : "CRITICAL",
          service: "system",
          environment: "production",
          component: "health_endpoint",
          message: `Health check status: ${data.status || (isOk ? "healthy" : "unhealthy")}`,
          attributes: data,
        },
      ];
    } catch (err) {
      return [
        {
          id: `health_err_${Date.now()}`,
          source: "health_check",
          source_type: "HEALTH_CHECK",
          timestamp: new Date().toISOString(),
          severity: "CRITICAL",
          service: "system",
          environment: "production",
          component: "health_endpoint",
          message: `Health check probe failed: ${err instanceof Error ? err.message : String(err)}`,
          attributes: { error: String(err) },
        },
      ];
    }
  }
}
