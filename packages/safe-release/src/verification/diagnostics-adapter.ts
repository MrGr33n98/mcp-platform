import { createHash } from "node:crypto";
import type { DiagnosticSnapshot, Observation } from "@mcp-platform/production-diagnostics";
import type { EnvironmentType } from "../types.js";

export class DiagnosticsAdapter {
  public static createSnapshot(params: {
    environment: EnvironmentType;
    observations?: Observation[] | undefined;
    providerStatus?: Record<string, string> | undefined;
    deploymentRevision?: string | undefined;
  }): DiagnosticSnapshot {
    const {
      environment,
      observations = [],
      providerStatus = { web: "UP", database: "UP", redis: "UP", sidekiq: "UP" },
      deploymentRevision
    } = params;

    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const capturedAt = new Date().toISOString();

    const digest = createHash("sha256")
      .update(
        JSON.stringify({
          snapshotId,
          environment,
          capturedAt,
          providerStatus,
          deploymentRevision,
          obsCount: observations.length
        })
      )
      .digest("hex");

    return {
      snapshot_id: snapshotId,
      environment,
      captured_at: capturedAt,
      deployment_revision: deploymentRevision,
      observations,
      provider_status: providerStatus,
      digest: `sha256:${digest}`
    };
  }
}
