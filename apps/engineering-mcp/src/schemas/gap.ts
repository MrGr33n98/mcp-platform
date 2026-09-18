import { z } from "zod";

export const analyzeSaasGapsInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
  })
  .strict();
