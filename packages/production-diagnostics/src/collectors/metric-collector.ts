import type { Observation, MetricsProvider, ObservationSeverity } from "../types.js";
import { TimestampNormalizer } from "../normalization/timestamp-normalizer.js";

export class MetricCollector {
  public static async collect(
    provider?: MetricsProvider | undefined,
    rawMetrics?: Record<string, unknown>[] | undefined,
    service: string = "web",
    environment: string = "production"
  ): Promise<Observation[]> {
    const observations: Observation[] = [];

    if (rawMetrics && rawMetrics.length > 0) {
      for (const m of rawMetrics) {
        const name = String(m.name || m.metric || "metric");
        const val = typeof m.value === "number" ? m.value : 0;
        const unit = String(m.unit || "");
        const timestamp = TimestampNormalizer.normalize(m.timestamp || m.time);

        let severity: ObservationSeverity = "INFO";
        if (name.includes("error_rate") && val > 0.05) severity = "ERROR";
        if (name.includes("latency_p99") && val > 2000) severity = "WARN";
        if (name.includes("cpu_usage") && val > 90) severity = "CRITICAL";

        observations.push({
          id: `metric_${name}_${Date.now()}`,
          source: "metrics_stream",
          source_type: "METRIC",
          timestamp,
          severity,
          service,
          environment,
          component: String(m.component || "infrastructure"),
          message: `${name}: ${val} ${unit}`.trim(),
          attributes: m,
        });
      }
    }

    if (provider) {
      const pMetrics = await provider.fetchMetrics();
      observations.push(...pMetrics);
    }

    return observations;
  }
}
