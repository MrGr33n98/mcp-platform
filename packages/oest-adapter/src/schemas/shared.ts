import { z } from "zod";
import {
  asId,
  identifierSchema,
  nullableTimestampSchema,
  optionalValue,
  safeStringSchema,
  timestampSchema,
} from "./common.js";

const envelopeMetaSchema = z.object({ request_id: z.string().optional() }).strip();

export const oestUsageSummaryInputSchema = z
  .object({ period: z.literal("current_period").optional() })
  .strict();

export const oestHealthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: safeStringSchema,
    time: timestampSchema,
    version: safeStringSchema,
  })
  .strict();

export const oestPlanResponseSchema = z
  .object({
    data: z
      .object({
        subscription_id: identifierSchema.nullable(),
        status: safeStringSchema,
        plan: z
          .object({
            id: identifierSchema,
            slug: safeStringSchema,
            name: safeStringSchema,
          })
          .nullable(),
      })
      .strip(),
    meta: envelopeMetaSchema.optional(),
  })
  .strip();

export const oestUsageResponseSchema = z
  .object({
    data: z
      .object({
        organization_id: identifierSchema,
        missions_count: z.number().int().nonnegative(),
        period: z.string().regex(/^\d{4}-\d{2}$/),
      })
      .strip(),
    meta: envelopeMetaSchema.optional(),
  })
  .strip();

const rawApiKeySchema = z
  .object({
    id: identifierSchema,
    name: safeStringSchema,
    prefix: safeStringSchema,
    scopes: z.array(safeStringSchema).max(100),
    last_used_at: nullableTimestampSchema,
  })
  .strip();

export const oestApiKeysResponseSchema = z
  .object({
    data: z.array(rawApiKeySchema).max(100),
    meta: envelopeMetaSchema.optional(),
  })
  .strip();

export function toOestSubscriptionSummary(
  response: z.output<typeof oestPlanResponseSchema>,
) {
  return {
    plan: response.data.plan?.name ?? "none",
    status: response.data.status,
  };
}

export function toOestUsageSummary(
  response: z.output<typeof oestUsageResponseSchema>,
) {
  return {
    metrics: [
      {
        name: "missions",
        value: response.data.missions_count,
        unit: "missions",
      },
    ],
  };
}

export function toOestApiKeyUsage(
  response: z.output<typeof oestApiKeysResponseSchema>,
) {
  return {
    items: response.data.map((item) => ({
      id: asId(item.id),
      name: item.name,
      prefix: item.prefix,
      scopes: item.scopes,
      ...(optionalValue(item.last_used_at) === undefined
        ? {}
        : { last_used_at: item.last_used_at }),
    })),
  };
}
