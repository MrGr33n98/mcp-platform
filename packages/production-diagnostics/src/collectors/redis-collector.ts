import type { Observation, CacheHealthProvider } from "../types.js";

export class RedisCollector {
  public static async collect(
    provider?: CacheHealthProvider | undefined,
    service: string = "redis",
    environment: string = "production"
  ): Promise<Observation[]> {
    if (!provider) return [];
    return provider.fetchCacheHealth();
  }
}
