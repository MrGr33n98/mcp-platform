import { z } from "zod";

const apiKeyMetadataSchema = z.string().trim().min(1).max(128);
const timestampSchema = z.string().datetime({ offset: true });

export const apiKeyUsageInputSchema = z.object({}).strict();

export const apiKeyUsageItemSchema = z
  .object({
    id: apiKeyMetadataSchema,
    name: apiKeyMetadataSchema.optional(),
    prefix: z.string().trim().min(1).max(24).optional(),
    scopes: z
      .array(z.string().trim().min(1).max(128).regex(/^[a-z][a-z0-9:_-]*$/))
      .max(50)
      .optional(),
    last_used_at: timestampSchema.optional(),
    request_count: z.number().int().min(0).optional(),
  })
  .strict();

export const apiKeyUsageResponseSchema = z
  .object({
    items: z.array(apiKeyUsageItemSchema).max(100),
  })
  .strict();

export type ApiKeyUsage = z.output<typeof apiKeyUsageResponseSchema>;
