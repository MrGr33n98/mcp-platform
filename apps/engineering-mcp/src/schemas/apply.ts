import { z } from "zod";

export const previewApplyInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    change_plan: z.record(z.string(), z.unknown()),
    vertical_slice_plan: z.record(z.string(), z.unknown()),
    verification_receipt: z.record(z.string(), z.unknown()),
    approval_receipt: z.record(z.string(), z.unknown()),
    options: z
      .object({
        customSecretKey: z.string().optional(),
        allowDirtyTreeForTest: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export const applyChangeInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    change_plan: z.record(z.string(), z.unknown()),
    vertical_slice_plan: z.record(z.string(), z.unknown()),
    verification_receipt: z.record(z.string(), z.unknown()),
    approval_receipt: z.record(z.string(), z.unknown()),
    options: z
      .object({
        dryRun: z.boolean().optional(),
        skipPostApplyTestExecution: z.boolean().optional(),
        customSecretKey: z.string().optional(),
        allowDirtyTreeForTest: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

export const rollbackApplyInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    snapshot_data: z.record(z.string(), z.unknown()),
    created_files: z.array(z.string()).optional().default([]),
    modified_files: z.array(z.string()).optional().default([]),
  })
  .strict();
