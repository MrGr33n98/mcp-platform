import type { Observation } from "../types.js";

export interface RequestTraceGroup {
  requestId: string;
  observations: Observation[];
  hasError: boolean;
  componentsInvolved: string[];
}

export class RequestCorrelator {
  public static groupByRequest(observations: Observation[]): Map<string, RequestTraceGroup> {
    const groups = new Map<string, RequestTraceGroup>();

    for (const obs of observations) {
      const reqId = obs.request_id || obs.trace_id;
      if (!reqId) continue;

      let group = groups.get(reqId);
      if (!group) {
        group = {
          requestId: reqId,
          observations: [],
          hasError: false,
          componentsInvolved: [],
        };
        groups.set(reqId, group);
      }

      group.observations.push(obs);
      if (obs.severity === "ERROR" || obs.severity === "CRITICAL") {
        group.hasError = true;
      }
      if (obs.component && !group.componentsInvolved.includes(obs.component)) {
        group.componentsInvolved.push(obs.component);
      }
    }

    return groups;
  }
}
