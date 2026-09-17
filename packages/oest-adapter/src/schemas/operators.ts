import { z } from "zod";
import {
  asId,
  identifierSchema,
  nullableSafeStringSchema,
  nonNegativeNumberSchema,
  optionalValue,
  safeStringSchema,
  slugInputSchema,
} from "./common.js";

export const listOperatorsInputSchema = z
  .object({ limit: z.number().int().min(1).max(100).default(25) })
  .strict();

export const operatorSlugInputSchema = z.object({ slug: slugInputSchema }).strict();

const rawOperatorCardSchema = z
  .object({
    id: identifierSchema,
    slug: slugInputSchema,
    name: safeStringSchema,
    headline: nullableSafeStringSchema,
    verification_status: safeStringSchema,
    verified: z.boolean(),
    rating_average: nonNegativeNumberSchema,
    rating_count: z.number().int().nonnegative(),
    missions_completed: z.number().int().nonnegative(),
    response_time_minutes: z.number().int().nonnegative().nullable(),
    accepting_jobs: z.boolean(),
    organization_name: safeStringSchema,
    city: nullableSafeStringSchema,
    state_code: nullableSafeStringSchema,
  })
  .strip();

export const oestOperatorsResponseSchema = z
  .object({ data: z.array(rawOperatorCardSchema).max(100) })
  .strip();

const rawOrganizationSchema = z
  .object({
    id: identifierSchema,
    name: safeStringSchema,
    slug: slugInputSchema,
    city: nullableSafeStringSchema,
    state_code: nullableSafeStringSchema,
    country_code: nullableSafeStringSchema,
    verified: z.boolean(),
  })
  .strip();

const rawServiceSchema = z
  .object({
    id: identifierSchema,
    title: safeStringSchema,
    description: nullableSafeStringSchema,
    pricing_model: safeStringSchema,
    price_from: nonNegativeNumberSchema.nullable(),
    currency: safeStringSchema,
    category: z.object({ slug: safeStringSchema, name: safeStringSchema }).nullable(),
  })
  .strip();

const rawDataProductSchema = z
  .object({
    id: identifierSchema,
    base_price: nonNegativeNumberSchema.nullable(),
    pricing_model: safeStringSchema,
    turnaround_hours: z.number().int().nonnegative().nullable(),
    product: z.object({ slug: safeStringSchema, name: safeStringSchema, product_type: safeStringSchema }).strip(),
  })
  .strip();

const rawOperatorProfileSchema = z
  .object({
    id: identifierSchema,
    slug: slugInputSchema,
    headline: nullableSafeStringSchema,
    about: nullableSafeStringSchema,
    verification_status: safeStringSchema,
    verified: z.boolean(),
    accepting_jobs: z.boolean(),
    currency: safeStringSchema,
    minimum_job_value: nonNegativeNumberSchema.nullable(),
    years_experience: z.number().int().nonnegative().nullable(),
    rating_average: nonNegativeNumberSchema,
    rating_count: z.number().int().nonnegative(),
    missions_completed: z.number().int().nonnegative(),
    response_time_minutes: z.number().int().nonnegative().nullable(),
    response_rate: nonNegativeNumberSchema.nullable(),
    organization: rawOrganizationSchema,
    services: z.array(rawServiceSchema).max(100),
    data_products: z.array(rawDataProductSchema).max(100),
    coverage_areas: z.array(z.object({ name: safeStringSchema, kind: safeStringSchema.optional() }).strip()).max(100),
  })
  .strip();

export const oestOperatorProfileResponseSchema = z
  .object({ data: rawOperatorProfileSchema })
  .strip();

export const operatorsOutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(), slug: z.string(), name: z.string(), headline: z.string().optional(),
    verification_status: z.string(), verified: z.boolean(), rating_average: z.number(),
    rating_count: z.number().int(), missions_completed: z.number().int(),
    response_time_minutes: z.number().int().optional(), accepting_jobs: z.boolean(),
    organization_name: z.string(), city: z.string().optional(), state_code: z.string().optional(),
  })),
  limit: z.number().int(),
});

export function toOperatorsOutput(
  response: z.output<typeof oestOperatorsResponseSchema>,
  input: z.output<typeof listOperatorsInputSchema>,
) {
  return operatorsOutputSchema.parse({
    items: response.data.map((operator) => ({
      id: asId(operator.id), slug: operator.slug, name: operator.name,
      ...(optionalValue(operator.headline) === undefined ? {} : { headline: operator.headline }),
      verification_status: operator.verification_status, verified: operator.verified,
      rating_average: operator.rating_average, rating_count: operator.rating_count,
      missions_completed: operator.missions_completed,
      ...(optionalValue(operator.response_time_minutes) === undefined ? {} : { response_time_minutes: operator.response_time_minutes }),
      accepting_jobs: operator.accepting_jobs, organization_name: operator.organization_name,
      ...(optionalValue(operator.city) === undefined ? {} : { city: operator.city }),
      ...(optionalValue(operator.state_code) === undefined ? {} : { state_code: operator.state_code }),
    })),
    limit: input.limit,
  });
}

export const operatorSummaryOutputSchema = z.object({
  id: z.string(), slug: z.string(), headline: z.string().optional(), about: z.string().optional(),
  verification_status: z.string(), verified: z.boolean(), accepting_jobs: z.boolean(), currency: z.string(),
  minimum_job_value: z.number().optional(), years_experience: z.number().int().optional(),
  rating_average: z.number(), rating_count: z.number().int(), missions_completed: z.number().int(),
  response_time_minutes: z.number().int().optional(), response_rate: z.number().optional(),
  organization: z.object({ id: z.string(), name: z.string(), slug: z.string(), city: z.string().optional(), state_code: z.string().optional(), country_code: z.string().optional(), verified: z.boolean() }),
  services: z.array(z.object({ id: z.string(), title: z.string(), description: z.string().optional(), pricing_model: z.string(), price_from: z.number().optional(), currency: z.string(), category: z.object({ slug: z.string(), name: z.string() }).optional() })),
  data_products: z.array(z.object({ id: z.string(), base_price: z.number().optional(), pricing_model: z.string(), turnaround_hours: z.number().int().optional(), product: z.object({ slug: z.string(), name: z.string(), product_type: z.string() }) })),
  coverage_areas: z.array(z.object({ name: z.string(), kind: z.string().optional() })),
});

export function toOperatorSummary(response: z.output<typeof oestOperatorProfileResponseSchema>) {
  const operator = response.data;
  return operatorSummaryOutputSchema.parse({
    id: asId(operator.id), slug: operator.slug,
    ...(optionalValue(operator.headline) === undefined ? {} : { headline: operator.headline }),
    ...(optionalValue(operator.about) === undefined ? {} : { about: operator.about }),
    verification_status: operator.verification_status, verified: operator.verified,
    accepting_jobs: operator.accepting_jobs, currency: operator.currency,
    ...(optionalValue(operator.minimum_job_value) === undefined ? {} : { minimum_job_value: operator.minimum_job_value }),
    ...(optionalValue(operator.years_experience) === undefined ? {} : { years_experience: operator.years_experience }),
    rating_average: operator.rating_average, rating_count: operator.rating_count,
    missions_completed: operator.missions_completed,
    ...(optionalValue(operator.response_time_minutes) === undefined ? {} : { response_time_minutes: operator.response_time_minutes }),
    ...(optionalValue(operator.response_rate) === undefined ? {} : { response_rate: operator.response_rate }),
    organization: {
      id: asId(operator.organization.id), name: operator.organization.name, slug: operator.organization.slug,
      ...(optionalValue(operator.organization.city) === undefined ? {} : { city: operator.organization.city }),
      ...(optionalValue(operator.organization.state_code) === undefined ? {} : { state_code: operator.organization.state_code }),
      ...(optionalValue(operator.organization.country_code) === undefined ? {} : { country_code: operator.organization.country_code }),
      verified: operator.organization.verified,
    },
    services: operator.services.map((service) => ({
      id: asId(service.id), title: service.title,
      ...(optionalValue(service.description) === undefined ? {} : { description: service.description }),
      pricing_model: service.pricing_model,
      ...(optionalValue(service.price_from) === undefined ? {} : { price_from: service.price_from }),
      currency: service.currency,
      ...(service.category === null ? {} : { category: service.category }),
    })),
    data_products: operator.data_products.map((dataProduct) => ({
      id: asId(dataProduct.id),
      ...(optionalValue(dataProduct.base_price) === undefined ? {} : { base_price: dataProduct.base_price }),
      pricing_model: dataProduct.pricing_model,
      ...(optionalValue(dataProduct.turnaround_hours) === undefined ? {} : { turnaround_hours: dataProduct.turnaround_hours }),
      product: dataProduct.product,
    })),
    coverage_areas: operator.coverage_areas,
  });
}
