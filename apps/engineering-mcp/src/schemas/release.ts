import { z } from "zod";

export const releasePlanInputSchema = z
  .object({
    product_name: z.string().trim().min(1, "product_name is required"),
    environment: z.enum(["LOCAL", "TEST", "STAGING", "CANARY", "PRODUCTION"]),
    artifact: z.object({
      artifact_id: z.string().min(1),
      artifact_type: z.enum(["DOCKER_IMAGE", "TARBALL", "DIRECTORY_BUNDLE", "STATIC_ASSETS"]),
      immutable_tag: z.string().min(1),
      digest: z.string().min(1),
      source_commit: z.string().min(1),
      build_id: z.string().min(1),
    }),
    strategy: z.enum(["REPLACE", "ROLLING", "BLUE_GREEN", "CANARY"]).optional(),
    timeout_ms: z.number().int().positive().optional(),
  })
  .strict();

export const verifyReleaseInputSchema = z
  .object({
    release_candidate: z.record(z.string(), z.unknown()),
    host_active_digest: z.string().optional(),
    raw_telemetry: z
      .object({
        service_healthy: z.boolean().optional(),
        db_connected: z.boolean().optional(),
        cache_connected: z.boolean().optional(),
        workers_active: z.boolean().optional(),
        endpoint_results: z
          .array(
            z.object({
              endpoint: z.string(),
              status_code: z.number(),
              latency_ms: z.number(),
              ok: z.boolean(),
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .strict();

export const rollbackReleaseInputSchema = z
  .object({
    failed_release_id: z.string().trim().min(1, "failed_release_id is required"),
    target_release: z.object({
      release_id: z.string().min(1),
      artifact_digest: z.string().min(1),
      immutable_tag: z.string().min(1),
      deployed_at: z.string().min(1),
      verification_receipt_id: z.string().min(1),
    }),
    reason: z.string().trim().min(1, "reason is required"),
    evidence: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  })
  .strict();
