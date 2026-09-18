import { z } from "zod";

export const planFeatureInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    product_name: z.string().trim().optional(),
    target_capability: z.string().trim().optional(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
