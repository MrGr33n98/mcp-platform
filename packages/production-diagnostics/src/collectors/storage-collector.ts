import type { Observation, StorageHealthProvider } from "../types.js";

export class StorageCollector {
  public static async collect(
    provider?: StorageHealthProvider | undefined,
    service: string = "storage",
    environment: string = "production"
  ): Promise<Observation[]> {
    if (!provider) return [];
    return provider.fetchStorageHealth();
  }
}
