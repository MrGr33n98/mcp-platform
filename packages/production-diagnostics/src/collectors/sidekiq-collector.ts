import type { Observation, QueueHealthProvider } from "../types.js";

export class SidekiqCollector {
  public static async collect(
    provider?: QueueHealthProvider | undefined,
    service: string = "sidekiq",
    environment: string = "production"
  ): Promise<Observation[]> {
    if (!provider) return [];
    return provider.fetchQueueHealth();
  }
}
