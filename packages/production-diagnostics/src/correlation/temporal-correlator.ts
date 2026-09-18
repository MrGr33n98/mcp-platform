import type { Observation, IncidentTimeline, TimelineEvent } from "../types.js";

export class TemporalCorrelator {
  public static buildTimeline(observations: Observation[]): IncidentTimeline {
    if (observations.length === 0) {
      const now = new Date().toISOString();
      return {
        events: [],
        started_at: now,
        detected_at: now,
        duration_minutes: 0,
      };
    }

    const sorted = [...observations].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    const events: TimelineEvent[] = [];
    let startedAt = sorted[0]?.timestamp || new Date().toISOString();
    let detectedAt = sorted[0]?.timestamp || new Date().toISOString();

    for (const obs of sorted) {
      events.push({
        timestamp: obs.timestamp,
        source: obs.source,
        type: obs.source_type,
        summary: obs.message,
        evidence_ids: [obs.id],
      });

      if (obs.severity === "ERROR" || obs.severity === "CRITICAL") {
        detectedAt = obs.timestamp;
      }
    }

    const startTime = new Date(startedAt).getTime();
    const lastTime = new Date(sorted[sorted.length - 1]?.timestamp || startedAt).getTime();
    const durationMinutes = Math.max(0, Math.round((lastTime - startTime) / (60 * 1000)));

    return {
      events,
      started_at: startedAt,
      detected_at: detectedAt,
      duration_minutes: durationMinutes,
    };
  }
}
