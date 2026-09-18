import type { DeploymentRecord, Observation } from "../types.js";

export interface DeploymentCorrelationResult {
  correlatedDeployment?: DeploymentRecord | undefined;
  isTemporallyCorrelated: boolean;
  minutesDifference: number;
  correlationType: "DIRECT_MATCH" | "TEMPORAL_ONLY" | "NO_KNOWN_RELATION";
  reason: string;
}

export class DeploymentCorrelator {
  public static correlate(
    deployments: DeploymentRecord[],
    firstErrorObservation?: Observation | undefined
  ): DeploymentCorrelationResult {
    if (!deployments || deployments.length === 0 || !firstErrorObservation) {
      return {
        isTemporallyCorrelated: false,
        minutesDifference: -1,
        correlationType: "NO_KNOWN_RELATION",
        reason: "No deployment records or error observations available to correlate.",
      };
    }

    const errorTime = new Date(firstErrorObservation.timestamp).getTime();

    // Find the closest deployment completed before or around the error
    let closestDeploy: DeploymentRecord | undefined = undefined;
    let minDiffMs = Infinity;

    for (const d of deployments) {
      const deployTime = new Date(d.started_at).getTime();
      const diffMs = errorTime - deployTime;

      // Check if deployment started up to 45 mins before the error
      if (diffMs >= 0 && diffMs < 45 * 60 * 1000) {
        if (diffMs < minDiffMs) {
          minDiffMs = diffMs;
          closestDeploy = d;
        }
      }
    }

    if (closestDeploy) {
      const minutesDiff = Math.round(minDiffMs / (60 * 1000));
      return {
        correlatedDeployment: closestDeploy,
        isTemporallyCorrelated: true,
        minutesDifference: minutesDiff,
        correlationType: "TEMPORAL_ONLY",
        reason: `Deployment ${closestDeploy.deployment_id} occurred ${minutesDiff} minute(s) prior to first error observation.`,
      };
    }

    return {
      isTemporallyCorrelated: false,
      minutesDifference: -1,
      correlationType: "NO_KNOWN_RELATION",
      reason: "No deployment found within temporal correlation window of the first error.",
    };
  }
}
