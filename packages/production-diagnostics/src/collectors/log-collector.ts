import type { Observation, LogProvider } from "../types.js";
import { EventNormalizer } from "../normalization/event-normalizer.js";

export class LogCollector {
  private static readonly MAX_LOGS_LIMIT = 500;

  public static async collect(
    provider?: LogProvider | undefined,
    rawLines?: string[] | undefined,
    service: string = "web",
    environment: string = "production"
  ): Promise<Observation[]> {
    const observations: Observation[] = [];

    if (rawLines && rawLines.length > 0) {
      const slice = rawLines.slice(-this.MAX_LOGS_LIMIT);
      for (const line of slice) {
        observations.push(EventNormalizer.normalizeLogLine(line, service, environment));
      }
    }

    if (provider) {
      const providerLogs = await provider.fetchRecentLogs(this.MAX_LOGS_LIMIT);
      observations.push(...providerLogs);
    }

    return observations;
  }
}
