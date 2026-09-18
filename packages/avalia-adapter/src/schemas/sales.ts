import { z } from "zod";
import {
  requiredIdentifierInputSchema,
  periodInputSchema,
  nonNegativeNumberSchema,
} from "./common.js";

export const getSalesPipelineInputSchema = z
  .object({
    company_id: requiredIdentifierInputSchema.optional(),
    period: periodInputSchema.optional(),
  })
  .strict();

export const salesPipelineResponseSchema = z
  .object({
    data: z
      .object({
        currency: z.string().default("BRL"),
        total_pipeline_value: nonNegativeNumberSchema,
        weighted_pipeline_value: nonNegativeNumberSchema.optional(),
        deals_count: z.number().int().nonnegative(),
        stages: z.array(
          z.object({
            stage_name: z.string(),
            count: z.number().int().nonnegative(),
            value: nonNegativeNumberSchema,
            win_probability: z.coerce.number().min(0).max(1).optional(),
          }),
        ),
      })
      .strip(),
  })
  .strip();
