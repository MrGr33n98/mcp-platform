import { z } from "zod";

export const analyzeBlastRadiusInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    target_capability: z.string().trim().optional(),
    vertical_slice_plan: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const verifyChangeInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    change_plan: z.record(z.string(), z.unknown()),
    vertical_slice_plan: z.record(z.string(), z.unknown()),
    options: z
      .object({
        mode: z.enum(["STATIC_VERIFY", "SAFE_TEST", "SAFE_BUILD"]).optional(),
        customRevision: z.record(z.string(), z.unknown()).optional(),
      })
      .optional(),
  })
  .strict();
