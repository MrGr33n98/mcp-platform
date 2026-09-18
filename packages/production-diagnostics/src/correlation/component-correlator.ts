import type { Observation } from "../types.js";

export class ComponentCorrelator {
  public static groupObservationsByComponent(observations: Observation[]): Map<string, Observation[]> {
    const map = new Map<string, Observation[]>();

    for (const obs of observations) {
      const comp = obs.component || "unknown";
      const list = map.get(comp) || [];
      list.push(obs);
      map.set(comp, list);
    }

    return map;
  }
}
