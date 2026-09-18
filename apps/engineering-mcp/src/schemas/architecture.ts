import { z } from "zod";

export const buildArchitectureGraphInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    focus_component: z.string().trim().optional(),
  })
  .strict();
