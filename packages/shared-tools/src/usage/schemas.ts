import { z } from "zod";

const usagePeriodSchema = z.enum([
  "current_period",
  "previous_period",
  "today",
  "last_7_days",
  "last_30_days",
]);

const metricNameSchema = z.string().trim().min(1).max(128);

export const usageSummaryInputSchema = z
  .object({
    period: usagePeriodSchema.optional(),
  })
  .strict();

export const usageMetricSchema = z
  .object({
    name: metricNameSchema,
    value: z.number().finite().min(0),
    unit: z.string().trim().min(1).max(64).optional(),
    limit: z.number().finite().min(0).optional(),
  })
  .strict();

export const usageSummaryResponseSchema = z
  .object({
    metrics: z.array(usageMetricSchema).max(100),
  })
  .strict();

export type UsageSummary = z.output<typeof usageSummaryResponseSchema>;
