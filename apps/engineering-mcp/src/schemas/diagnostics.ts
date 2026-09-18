import { z } from "zod";

export const diagnoseProductionInputSchema = z
  .object({
    environment: z.string().trim().min(1, "environment is required"),
    product_name: z.string().trim().min(1, "product_name is required"),
    repository_path: z.string().trim().optional(),
    raw_logs: z.array(z.string()).optional(),
    raw_errors: z.array(z.record(z.string(), z.unknown())).optional(),
    raw_metrics: z.array(z.record(z.string(), z.unknown())).optional(),
    deployments: z.array(z.record(z.string(), z.unknown())).optional(),
    time_window_minutes: z.number().int().positive().max(1440).optional().default(60),
  })
  .strict();
