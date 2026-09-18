import type { Observation, Symptom, SymptomType } from "../types.js";

export class SymptomClassifier {
  public static classify(observations: Observation[]): Symptom[] {
    const symptomMap = new Map<SymptomType, Symptom>();

    for (const obs of observations) {
      const detectedTypes = this.detectSymptomTypes(obs);

      for (const type of detectedTypes) {
        let sym = symptomMap.get(type);
        if (!sym) {
          sym = {
            type,
            description: this.getDefaultDescription(type),
            severity: obs.severity,
            first_seen: obs.timestamp,
            last_seen: obs.timestamp,
            count: 0,
            affected_components: [],
            evidence_ids: [],
          };
          symptomMap.set(type, sym);
        }

        sym.count++;
        sym.last_seen = obs.timestamp;
        if (obs.severity === "CRITICAL") sym.severity = "CRITICAL";

        if (obs.component && !sym.affected_components.includes(obs.component)) {
          sym.affected_components.push(obs.component);
        }
        if (!sym.evidence_ids.includes(obs.id)) {
          sym.evidence_ids.push(obs.id);
        }
      }
    }

    return Array.from(symptomMap.values());
  }

  private static detectSymptomTypes(obs: Observation): SymptomType[] {
    const types: SymptomType[] = [];
    const msg = obs.message.toLowerCase();

    if (obs.severity === "ERROR" || obs.severity === "CRITICAL") {
      if (
        msg.includes("500") ||
        msg.includes("internal server error") ||
        msg.includes("nomethoderror") ||
        msg.includes("undefined method") ||
        msg.includes("standarderror") ||
        msg.includes("runtimeerror") ||
        msg.includes("argumenterror") ||
        msg.includes("error") ||
        msg.includes("exception")
      ) {
        types.push("HTTP_5XX_SPIKE");
      }
      if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("net::readtimeout")) {
        types.push("TIMEOUT");
      }
      if (
        msg.includes("pg::connectionbad") ||
        msg.includes("database connection") ||
        msg.includes("active_record::connectiontimeouterror")
      ) {
        types.push("DATABASE_CONNECTION_FAILURE");
      }
      if (msg.includes("redis::cannotconnecterror") || msg.includes("redis connection")) {
        types.push("REDIS_FAILURE");
      }
      if (msg.includes("sidekiq") && (msg.includes("retry") || msg.includes("fail") || msg.includes("dead"))) {
        types.push("JOB_FAILURE");
      }
      if (msg.includes("out of memory") || msg.includes("oomkiller") || msg.includes("oom")) {
        types.push("OOM");
      }
      if (msg.includes("unauthorized") || msg.includes("401") || msg.includes("forbidden") || msg.includes("403")) {
        types.push("AUTH_FAILURE");
      }
      if (msg.includes("external api") || msg.includes("stripe api") || msg.includes("upstream")) {
        types.push("EXTERNAL_API_FAILURE");
      }
    }

    if (obs.source_type === "METRIC") {
      if (msg.includes("latency") || msg.includes("slow")) types.push("LATENCY_SPIKE");
      if (msg.includes("cpu") && msg.includes("9")) types.push("CPU_PRESSURE");
      if (msg.includes("queue") && (msg.includes("backlog") || msg.includes("depth"))) types.push("QUEUE_BACKLOG");
    }

    return types;
  }

  private static getDefaultDescription(type: SymptomType): string {
    switch (type) {
      case "HTTP_5XX_SPIKE": return "Spike in HTTP 500 / unhandled application runtime exceptions detected.";
      case "TIMEOUT": return "Request or socket timeouts detected in operational stream.";
      case "DATABASE_CONNECTION_FAILURE": return "Database connection pool exhaustion or connectivity failures.";
      case "DATABASE_SLOW_QUERY": return "High latency database queries exceeding operational thresholds.";
      case "REDIS_FAILURE": return "Redis cache or queue store connectivity failures.";
      case "QUEUE_BACKLOG": return "Background job queue accumulation and high latency.";
      case "JOB_FAILURE": return "Execution failures in background jobs or workers.";
      case "OOM": return "Out of memory process termination or memory saturation.";
      case "EXTERNAL_API_FAILURE": return "Connectivity or error responses from upstream external APIs.";
      case "AUTH_FAILURE": return "Elevated rate of authentication or authorization rejections.";
      case "DEPLOYMENT_FAILURE": return "Deployment pipeline error or incomplete container rollout.";
      default: return `Observable symptom: ${type}`;
    }
  }
}
