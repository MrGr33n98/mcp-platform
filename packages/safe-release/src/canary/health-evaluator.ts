import type {
  CanaryPolicy,
  HealthEvaluation,
  HealthStatus,
  SignalEvaluation
} from "../types.js";
import type { Observation } from "@mcp-platform/production-diagnostics";

export class HealthEvaluator {
  public static evaluate(params: {
    policy: CanaryPolicy;
    telemetry?: {
      total_requests?: number | undefined;
      error_5xx_count?: number | undefined;
      p95_latency_ms?: number | undefined;
      observations?: Observation[] | undefined;
    } | undefined;
  }): HealthEvaluation {
    const { policy, telemetry } = params;
    const signals: Record<string, SignalEvaluation> = {};
    const rationale: string[] = [];

    // 1. Checagem de Telemetria Disponível
    if (
      !telemetry ||
      (telemetry.total_requests === undefined &&
        telemetry.error_5xx_count === undefined &&
        (!telemetry.observations || telemetry.observations.length === 0))
    ) {
      return {
        status: "INSUFFICIENT_EVIDENCE",
        signals_evaluated: {
          telemetry_stream: {
            available: false,
            status: "MISSING"
          }
        },
        rationale: [
          "INSUFFICIENT_EVIDENCE: No telemetry signals, request counts, or error logs were received during observation window."
        ]
      };
    }

    const totalRequests = telemetry.total_requests ?? 0;
    const error5xxCount = telemetry.error_5xx_count ?? 0;
    const p95Latency = telemetry.p95_latency_ms ?? 0;
    const observations = telemetry.observations ?? [];

    let isUnhealthy = false;
    let isDegraded = false;

    // 2. Volume Mínimo de Requisições
    if (totalRequests < policy.minimum_requests && totalRequests > 0) {
      signals["sample_size"] = {
        available: true,
        value: totalRequests,
        threshold: policy.minimum_requests,
        status: "WARN"
      };
      isDegraded = true;
      rationale.push(
        `Low sample size: Observed ${totalRequests} requests (expected minimum: ${policy.minimum_requests}).`
      );
    } else if (totalRequests >= policy.minimum_requests) {
      signals["sample_size"] = {
        available: true,
        value: totalRequests,
        threshold: policy.minimum_requests,
        status: "PASS"
      };
    }

    // 3. Taxa de HTTP 5xx
    if (totalRequests > 0) {
      const errorRate = error5xxCount / totalRequests;
      const threshold = policy.health_thresholds.max_http_5xx_rate;
      if (errorRate > threshold) {
        signals["http_5xx_rate"] = {
          available: true,
          value: errorRate,
          threshold,
          status: "FAIL"
        };
        isUnhealthy = true;
        rationale.push(
          `HTTP 5xx rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}%.`
        );
      } else {
        signals["http_5xx_rate"] = {
          available: true,
          value: errorRate,
          threshold,
          status: "PASS"
        };
      }
    }

    // 4. Latência P95
    if (p95Latency > 0) {
      const threshold = policy.health_thresholds.max_latency_p95_ms;
      if (p95Latency > threshold) {
        signals["p95_latency"] = {
          available: true,
          value: p95Latency,
          threshold,
          status: "FAIL"
        };
        isUnhealthy = true;
        rationale.push(
          `P95 latency ${p95Latency}ms exceeds threshold ${threshold}ms.`
        );
      } else {
        signals["p95_latency"] = {
          available: true,
          value: p95Latency,
          threshold,
          status: "PASS"
        };
      }
    }

    // 5. Contagem de Erros Críticos nos Logs
    const criticalObservations = observations.filter(
      (o) => o.severity === "CRITICAL" || o.severity === "ERROR"
    );
    if (criticalObservations.length > policy.health_thresholds.max_error_count) {
      signals["application_errors"] = {
        available: true,
        value: criticalObservations.length,
        threshold: policy.health_thresholds.max_error_count,
        status: "FAIL"
      };
      isUnhealthy = true;
      rationale.push(
        `Critical error count (${criticalObservations.length}) exceeds threshold (${policy.health_thresholds.max_error_count}).`
      );
    } else {
      signals["application_errors"] = {
        available: true,
        value: criticalObservations.length,
        threshold: policy.health_thresholds.max_error_count,
        status: "PASS"
      };
    }

    let finalStatus: HealthStatus = "HEALTHY";
    if (isUnhealthy) {
      finalStatus = "UNHEALTHY";
    } else if (isDegraded) {
      finalStatus = "DEGRADED";
    }

    return {
      status: finalStatus,
      signals_evaluated: signals,
      rationale: rationale.length > 0 ? rationale : ["All observed canary health signals within acceptable thresholds."]
    };
  }
}
