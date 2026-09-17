import { z } from "zod";
import { paginationInputSchema, paginationOutputSchema } from "../pagination/pagination.js";

const webhookTextSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.string().datetime({ offset: true });

export const failedWebhooksInputSchema = paginationInputSchema;

export const failedWebhookItemSchema = z
  .object({
    id: webhookTextSchema,
    event_type: webhookTextSchema,
    status: webhookTextSchema,
    attempts: z.number().int().min(0).max(1_000),
    last_attempt_at: timestampSchema.optional(),
    created_at: timestampSchema.optional(),
  })
  .strict();

export const failedWebhooksResponseSchema = z
  .object({
    items: z.array(failedWebhookItemSchema).max(100),
    pagination: paginationOutputSchema,
  })
  .strict();

export type FailedWebhooks = z.output<typeof failedWebhooksResponseSchema>;
