import type { Observation, Evidence } from "../types.js";

export class EvidenceChain {
  public static fromObservations(observations: Observation[]): Evidence[] {
    const evidenceList: Evidence[] = [];

    for (const obs of observations) {
      // Only keep informative or anomalous observations as formal evidence
      if (obs.severity === "ERROR" || obs.severity === "CRITICAL" || obs.severity === "WARN") {
        const evidenceId = `ev_${obs.id}`;
        const excerpt = obs.raw_excerpt || obs.message;
        const confidence = obs.severity === "CRITICAL" ? 0.95 : obs.severity === "ERROR" ? 0.85 : 0.65;

        evidenceList.push({
          evidence_id: evidenceId,
          source: obs.source,
          timestamp: obs.timestamp,
          collector: obs.source_type,
          locator: `${obs.service}/${obs.component}`,
          sanitized_excerpt: excerpt,
          fingerprint: obs.fingerprint || "no_fingerprint",
          confidence,
        });
      }
    }

    return evidenceList;
  }
}
