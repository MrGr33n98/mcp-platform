import { z } from "zod";

export const scanRepositoryInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    workspace_mode: z.boolean().optional().default(false),
  })
  .strict();

export const getRepositoryEvidenceInputSchema = z
  .object({
    repository_path: z.string().trim().min(1, "repository_path is required"),
    evidence_type: z.string().trim().optional(),
    min_confidence: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  })
  .strict();
