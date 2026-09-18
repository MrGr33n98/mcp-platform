import type { Observation, DatabaseHealthProvider } from "../types.js";

export class DatabaseCollector {
  public static async collect(
    provider?: DatabaseHealthProvider | undefined,
    service: string = "postgres",
    environment: string = "production"
  ): Promise<Observation[]> {
    if (!provider) return [];
    return provider.fetchDatabaseHealth();
  }
}
