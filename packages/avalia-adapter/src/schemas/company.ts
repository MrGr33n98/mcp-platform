import { z } from "zod";
import {
  identifierSchema,
  requiredIdentifierInputSchema,
  safeStringSchema,
  nullableSafeStringSchema,
  nonNegativeNumberSchema,
  timestampSchema,
} from "./common.js";

export const getCompanySummaryInputSchema = z
  .object({
    company_id: requiredIdentifierInputSchema,
  })
  .strict();

export const companySummaryResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        legal_name: safeStringSchema,
        trade_name: nullableSafeStringSchema.optional(),
        stage: z.enum(["lead", "prospect", "active", "churned", "partner"]),
        plan_name: safeStringSchema.optional(),
        rating: z.coerce.number().min(0).max(5).optional(),
        total_reviews: z.number().int().nonnegative().default(0),
        total_leads: z.number().int().nonnegative().default(0),
        active_pipeline_value: nonNegativeNumberSchema.default(0),
        created_at: timestampSchema.optional(),
      })
      .strip(),
  })
  .strip();
