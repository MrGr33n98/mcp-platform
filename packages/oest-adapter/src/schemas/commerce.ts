import { z } from "zod";
import {
  asId,
  identifierSchema,
  nullableTimestampSchema,
  nonNegativeNumberSchema,
  optionalValue,
  requiredIdentifierInputSchema,
  safeStringSchema,
} from "./common.js";

export const missionIdentifierInputSchema = z.object({ id: requiredIdentifierInputSchema }).strict();
export const orderIdentifierInputSchema = z.object({ id: requiredIdentifierInputSchema }).strict();

const rawQuoteSchema = z
  .object({
    id: identifierSchema,
    status: safeStringSchema,
    subtotal: nonNegativeNumberSchema,
    platform_fee: nonNegativeNumberSchema,
    taxes: nonNegativeNumberSchema,
    total: nonNegativeNumberSchema,
    currency: safeStringSchema,
    estimated_start_at: nullableTimestampSchema,
    estimated_delivery_at: nullableTimestampSchema,
    submitted_at: nullableTimestampSchema,
    acceptible: z.boolean().optional(),
    operator: z
      .object({
        slug: safeStringSchema,
        headline: z.string().trim().max(4_000).nullable(),
        verified: z.boolean(),
        rating_average: nonNegativeNumberSchema,
        rating_count: z.number().int().nonnegative(),
        missions_completed: z.number().int().nonnegative(),
        organization_name: safeStringSchema,
      })
      .strip(),
  })
  .strip();

export const oestQuoteComparisonResponseSchema = z
  .object({
    data: z
      .object({
        mission: z
          .object({
            id: identifierSchema,
            title: safeStringSchema,
            status: safeStringSchema,
            area_hectares: nonNegativeNumberSchema.nullable(),
            deadline_at: nullableTimestampSchema,
            currency: safeStringSchema,
          })
          .strip(),
        quotes: z.array(rawQuoteSchema).max(100),
      })
      .strip(),
  })
  .strip();

export const quoteSummaryOutputSchema = z.object({
  mission: z.object({ id: z.string(), title: z.string(), status: z.string(), area_hectares: z.number().optional(), deadline_at: z.string().optional(), currency: z.string() }),
  quotes: z.array(z.object({
    id: z.string(), status: z.string(), subtotal: z.number(), platform_fee: z.number(), taxes: z.number(), total: z.number(), currency: z.string(),
    estimated_start_at: z.string().optional(), estimated_delivery_at: z.string().optional(), submitted_at: z.string().optional(), acceptable: z.boolean().optional(),
    operator: z.object({ slug: z.string(), headline: z.string().optional(), verified: z.boolean(), rating_average: z.number(), rating_count: z.number().int(), missions_completed: z.number().int(), organization_name: z.string() }),
  })),
});

export function toQuoteSummary(response: z.output<typeof oestQuoteComparisonResponseSchema>) {
  const comparison = response.data;
  return quoteSummaryOutputSchema.parse({
    mission: {
      id: asId(comparison.mission.id), title: comparison.mission.title, status: comparison.mission.status,
      ...(optionalValue(comparison.mission.area_hectares) === undefined ? {} : { area_hectares: comparison.mission.area_hectares }),
      ...(optionalValue(comparison.mission.deadline_at) === undefined ? {} : { deadline_at: comparison.mission.deadline_at }),
      currency: comparison.mission.currency,
    },
    quotes: comparison.quotes.map((quote) => ({
      id: asId(quote.id), status: quote.status, subtotal: quote.subtotal,
      platform_fee: quote.platform_fee, taxes: quote.taxes, total: quote.total, currency: quote.currency,
      ...(optionalValue(quote.estimated_start_at) === undefined ? {} : { estimated_start_at: quote.estimated_start_at }),
      ...(optionalValue(quote.estimated_delivery_at) === undefined ? {} : { estimated_delivery_at: quote.estimated_delivery_at }),
      ...(optionalValue(quote.submitted_at) === undefined ? {} : { submitted_at: quote.submitted_at }),
      ...(quote.acceptible === undefined ? {} : { acceptable: quote.acceptible }),
      operator: {
        slug: quote.operator.slug,
        ...(optionalValue(quote.operator.headline) === undefined ? {} : { headline: quote.operator.headline }),
        verified: quote.operator.verified, rating_average: quote.operator.rating_average,
        rating_count: quote.operator.rating_count, missions_completed: quote.operator.missions_completed,
        organization_name: quote.operator.organization_name,
      },
    })),
  });
}

export const oestOrderResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        mission_id: identifierSchema,
        status: safeStringSchema,
        payment_status: safeStringSchema,
        total: nonNegativeNumberSchema,
        currency: safeStringSchema,
        marketplace_fee: nonNegativeNumberSchema,
        operator_amount: nonNegativeNumberSchema,
        accepted_at: nullableTimestampSchema,
        completed_at: nullableTimestampSchema,
      })
      .strip(),
  })
  .strip();

export const orderSummaryOutputSchema = z.object({
  id: z.string(), mission_id: z.string(), status: z.string(), payment_status: z.string(),
  total: z.number(), currency: z.string(), marketplace_fee: z.number(), operator_amount: z.number(),
  accepted_at: z.string().optional(), completed_at: z.string().optional(),
});

export function toOrderSummary(response: z.output<typeof oestOrderResponseSchema>) {
  const order = response.data;
  return orderSummaryOutputSchema.parse({
    id: asId(order.id), mission_id: asId(order.mission_id), status: order.status,
    payment_status: order.payment_status, total: order.total, currency: order.currency,
    marketplace_fee: order.marketplace_fee, operator_amount: order.operator_amount,
    ...(optionalValue(order.accepted_at) === undefined ? {} : { accepted_at: order.accepted_at }),
    ...(optionalValue(order.completed_at) === undefined ? {} : { completed_at: order.completed_at }),
  });
}

const rawDeliverableSchema = z
  .object({
    id: identifierSchema,
    mission_id: identifierSchema,
    data_product_id: identifierSchema,
    title: safeStringSchema,
    status: safeStringSchema,
    version: z.number().int().nonnegative(),
  })
  .strip();

export const oestDeliverablesResponseSchema = z
  .object({ data: z.array(rawDeliverableSchema).max(100) })
  .strip();

export const deliverableSummaryOutputSchema = z.object({
  items: z.array(z.object({ id: z.string(), mission_id: z.string(), data_product_id: z.string(), title: z.string(), status: z.string(), version: z.number().int() })),
});

export function toDeliverableSummary(response: z.output<typeof oestDeliverablesResponseSchema>) {
  return deliverableSummaryOutputSchema.parse({
    items: response.data.map((deliverable) => ({
      id: asId(deliverable.id), mission_id: asId(deliverable.mission_id),
      data_product_id: asId(deliverable.data_product_id), title: deliverable.title,
      status: deliverable.status, version: deliverable.version,
    })),
  });
}
