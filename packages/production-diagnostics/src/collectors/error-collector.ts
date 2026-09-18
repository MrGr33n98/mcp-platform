import type { Observation, ErrorProvider } from "../types.js";
import { EventNormalizer } from "../normalization/event-normalizer.js";

export class ErrorCollector {
  public static async collect(
    provider?: ErrorProvider | undefined,
    rawErrors?: Record<string, unknown>[] | undefined,
    service: string = "web",
    environment: string = "production"
  ): Promise<Observation[]> {
    const observations: Observation[] = [];

    if (rawErrors && rawErrors.length > 0) {
      for (const err of rawErrors) {
        observations.push(EventNormalizer.normalizeErrorObject(err, service, environment));
      }
    }

    if (provider) {
      const pErrors = await provider.fetchRecentErrors();
      observations.push(...pErrors);
    }

    return observations;
  }
}
