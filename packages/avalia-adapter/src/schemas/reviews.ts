import { z } from "zod";
import {
  requiredIdentifierInputSchema,
  periodInputSchema,
  nonNegativeNumberSchema,
} from "./common.js";

export const getReviewSummaryInputSchema = z
  .object({
    company_id: requiredIdentifierInputSchema.optional(),
    period: periodInputSchema.optional(),
  })
  .strict();

export const reviewSummaryResponseSchema = z
  .object({
    data: z
      .object({
        average_score: z.coerce.number().min(0).max(5),
        total_reviews: z.number().int().nonnegative(),
        nps_score: z.coerce.number().min(-100).max(100).optional(),
        distribution: z.record(z.string(), z.number().int().nonnegative()),
        positive_sentiment_ratio: z.coerce.number().min(0).max(1).optional(),
      })
      .strip(),
  })
  .strip();
