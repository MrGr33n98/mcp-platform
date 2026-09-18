import { z } from "zod";
import {
  requiredIdentifierInputSchema,
  periodInputSchema,
  safeStringSchema,
  nonNegativeNumberSchema,
} from "./common.js";

export const getLeadSummaryInputSchema = z
  .object({
    company_id: requiredIdentifierInputSchema.optional(),
    period: periodInputSchema.optional(),
    source: safeStringSchema.optional(),
  })
  .strict();

export const leadSummaryResponseSchema = z
  .object({
    data: z
      .object({
        total_leads: z.number().int().nonnegative(),
        qualified_leads: z.number().int().nonnegative(),
        conversion_rate: z.coerce.number().min(0).max(1),
        by_source: z.record(z.string(), z.number().int().nonnegative()),
        by_stage: z.record(z.string(), z.number().int().nonnegative()),
        estimated_monthly_consumption_kwh: nonNegativeNumberSchema.optional(),
      })
      .strip(),
  })
  .strip();
