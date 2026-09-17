import { z } from "zod";

const planNameSchema = z.string().trim().min(1).max(128);
const statusSchema = z.string().trim().min(1).max(64);
const timestampSchema = z.string().datetime({ offset: true });

export const subscriptionSummaryInputSchema = z.object({}).strict();

export const usageLimitSchema = z
  .object({
    name: planNameSchema,
    limit: z.number().finite().min(0),
    unit: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const subscriptionSummaryResponseSchema = z
  .object({
    plan: planNameSchema,
    status: statusSchema,
    billing_interval: z.string().trim().min(1).max(64).optional(),
    current_period_start: timestampSchema.optional(),
    current_period_end: timestampSchema.optional(),
    usage_limits: z.array(usageLimitSchema).max(100).optional(),
  })
  .strict();

export type SubscriptionSummary = z.output<typeof subscriptionSummaryResponseSchema>;
