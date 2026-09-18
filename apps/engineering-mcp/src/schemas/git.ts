import { z } from "zod";

export const gitStatusInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
  })
  .strict();

export const prepareBranchInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    branch_name: z.string().trim().min(1, "branch_name is required"),
  })
  .strict();

export const prepareCommitInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    change_plan: z.record(z.string(), z.unknown()),
    vertical_slice_plan: z.record(z.string(), z.unknown()).optional(),
    apply_receipt: z.record(z.string(), z.unknown()),
    verification_receipt: z.record(z.string(), z.unknown()),
    git_approval_receipt: z.record(z.string(), z.unknown()),
    commit_message: z.string().trim().optional(),
    options: z
      .object({
        customSecretKey: z.string().optional(),
        allowDirtyTreeForTest: z.boolean().optional(),
        dryRun: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();
