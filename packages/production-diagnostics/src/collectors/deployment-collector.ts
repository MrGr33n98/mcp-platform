import type { DeploymentRecord, DeploymentProvider } from "../types.js";

export class DeploymentCollector {
  public static async collect(
    provider?: DeploymentProvider | undefined,
    rawDeployments?: DeploymentRecord[] | undefined
  ): Promise<DeploymentRecord[]> {
    const records: DeploymentRecord[] = [];

    if (rawDeployments && rawDeployments.length > 0) {
      records.push(...rawDeployments);
    }

    if (provider) {
      const pDeployments = await provider.fetchRecentDeployments();
      records.push(...pDeployments);
    }

    return records;
  }
}
