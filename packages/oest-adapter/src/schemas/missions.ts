import { z } from "zod";
import {
  asId,
  identifierSchema,
  nullableSafeStringSchema,
  nullableTimestampSchema,
  nonNegativeNumberSchema,
  optionalValue,
  requiredIdentifierInputSchema,
  safeStringSchema,
  timestampSchema,
} from "./common.js";

export const listMissionsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().min(0).default(0),
  })
  .strict();

export const missionIdentifierInputSchema = z
  .object({ id: requiredIdentifierInputSchema })
  .strict();

const rawMissionListItemSchema = z
  .object({
    id: identifierSchema,
    title: safeStringSchema,
    status: safeStringSchema,
    mission_type: safeStringSchema,
    area_hectares: nonNegativeNumberSchema.nullable(),
    deadline_at: nullableTimestampSchema,
    published_at: nullableTimestampSchema,
    version: z.number().int().nonnegative(),
  })
  .strip();

export const oestMissionsResponseSchema = z
  .object({ data: z.array(rawMissionListItemSchema).max(100) })
  .strip();

const rawProductSchema = z
  .object({
    data_product_id: identifierSchema,
    quantity: z.number().finite().positive(),
    name: safeStringSchema,
    slug: safeStringSchema,
  })
  .strip();

const rawOrderSchema = z
  .object({
    id: identifierSchema,
    status: safeStringSchema,
    payment_status: safeStringSchema,
    total: nonNegativeNumberSchema,
    currency: safeStringSchema,
  })
  .strip();

const rawOperatorSchema = z
  .object({
    slug: safeStringSchema,
    name: safeStringSchema,
    verified: z.boolean(),
    headline: nullableSafeStringSchema,
  })
  .strip();

const rawDeliverableSchema = z
  .object({
    id: identifierSchema,
    title: safeStringSchema,
    status: safeStringSchema,
    version: z.number().int().nonnegative(),
    data_product_id: identifierSchema,
    file_format: nullableSafeStringSchema,
    download_ready: z.boolean(),
  })
  .strip();

export const rawMissionSchema = z
  .object({
    id: identifierSchema,
    title: safeStringSchema,
    description: nullableSafeStringSchema,
    status: safeStringSchema,
    mission_type: safeStringSchema,
    priority: safeStringSchema,
    area_hectares: nonNegativeNumberSchema.nullable(),
    deadline_at: nullableTimestampSchema,
    preferred_start_at: nullableTimestampSchema,
    published_at: nullableTimestampSchema,
    completed_at: nullableTimestampSchema,
    currency: safeStringSchema,
    estimated_budget_min: nonNegativeNumberSchema.nullable(),
    estimated_budget_max: nonNegativeNumberSchema.nullable(),
    project_id: identifierSchema.nullable(),
    products: z.array(rawProductSchema).max(100),
    quotes_summary: z.object({ open_count: z.number().int().nonnegative() }).strip(),
    order: rawOrderSchema.nullable(),
    operator: rawOperatorSchema.nullable(),
    deliverables: z.array(rawDeliverableSchema).max(100),
  })
  .strip();

export const oestMissionResponseSchema = z
  .object({ data: rawMissionSchema })
  .strip();

function safeMissionShape(mission: z.output<typeof rawMissionSchema>) {
  return {
    id: asId(mission.id),
    title: mission.title,
    ...(optionalValue(mission.description) === undefined
      ? {}
      : { description: mission.description }),
    status: mission.status,
    mission_type: mission.mission_type,
    priority: mission.priority,
    ...(optionalValue(mission.area_hectares) === undefined
      ? {}
      : { area_hectares: mission.area_hectares }),
    ...(optionalValue(mission.deadline_at) === undefined
      ? {}
      : { deadline_at: mission.deadline_at }),
    ...(optionalValue(mission.preferred_start_at) === undefined
      ? {}
      : { preferred_start_at: mission.preferred_start_at }),
    ...(optionalValue(mission.published_at) === undefined
      ? {}
      : { published_at: mission.published_at }),
    ...(optionalValue(mission.completed_at) === undefined
      ? {}
      : { completed_at: mission.completed_at }),
    currency: mission.currency,
    ...(optionalValue(mission.estimated_budget_min) === undefined
      ? {}
      : { estimated_budget_min: mission.estimated_budget_min }),
    ...(optionalValue(mission.estimated_budget_max) === undefined
      ? {}
      : { estimated_budget_max: mission.estimated_budget_max }),
    products: mission.products.map((product) => ({
      data_product_id: asId(product.data_product_id),
      quantity: product.quantity,
      name: product.name,
      slug: product.slug,
    })),
    quotes_open_count: mission.quotes_summary.open_count,
    ...(mission.order === null
      ? {}
      : {
          order: {
            id: asId(mission.order.id),
            status: mission.order.status,
            payment_status: mission.order.payment_status,
            total: mission.order.total,
            currency: mission.order.currency,
          },
        }),
    ...(mission.operator === null
      ? {}
      : {
          operator: {
            slug: mission.operator.slug,
            name: mission.operator.name,
            verified: mission.operator.verified,
            ...(optionalValue(mission.operator.headline) === undefined
              ? {}
              : { headline: mission.operator.headline }),
          },
        }),
    deliverables: mission.deliverables.map((deliverable) => ({
      id: asId(deliverable.id),
      title: deliverable.title,
      status: deliverable.status,
      version: deliverable.version,
      data_product_id: asId(deliverable.data_product_id),
      ...(optionalValue(deliverable.file_format) === undefined
        ? {}
        : { file_format: deliverable.file_format }),
      download_ready: deliverable.download_ready,
    })),
  };
}

export const missionOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  mission_type: z.string(),
  priority: z.string(),
  area_hectares: z.number().optional(),
  deadline_at: z.string().optional(),
  preferred_start_at: z.string().optional(),
  published_at: z.string().optional(),
  completed_at: z.string().optional(),
  currency: z.string(),
  estimated_budget_min: z.number().optional(),
  estimated_budget_max: z.number().optional(),
  products: z.array(z.object({ data_product_id: z.string(), quantity: z.number(), name: z.string(), slug: z.string() })),
  quotes_open_count: z.number().int(),
  order: z.object({ id: z.string(), status: z.string(), payment_status: z.string(), total: z.number(), currency: z.string() }).optional(),
  operator: z.object({ slug: z.string(), name: z.string(), verified: z.boolean(), headline: z.string().optional() }).optional(),
  deliverables: z.array(z.object({ id: z.string(), title: z.string(), status: z.string(), version: z.number().int(), data_product_id: z.string(), file_format: z.string().optional(), download_ready: z.boolean() })),
});

export function toMissionOutput(response: z.output<typeof oestMissionResponseSchema>) {
  return missionOutputSchema.parse(safeMissionShape(response.data));
}

export const missionSummaryOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  mission_type: z.string(),
  priority: z.string(),
  area_hectares: z.number().optional(),
  deadline_at: z.string().optional(),
  published_at: z.string().optional(),
  completed_at: z.string().optional(),
  currency: z.string(),
  quotes_open_count: z.number().int(),
  deliverables_count: z.number().int().nonnegative(),
  order_status: z.string().optional(),
});

export function toMissionSummary(response: z.output<typeof oestMissionResponseSchema>) {
  const mission = response.data;
  return missionSummaryOutputSchema.parse({
    id: asId(mission.id),
    title: mission.title,
    status: mission.status,
    mission_type: mission.mission_type,
    priority: mission.priority,
    ...(optionalValue(mission.area_hectares) === undefined ? {} : { area_hectares: mission.area_hectares }),
    ...(optionalValue(mission.deadline_at) === undefined ? {} : { deadline_at: mission.deadline_at }),
    ...(optionalValue(mission.published_at) === undefined ? {} : { published_at: mission.published_at }),
    ...(optionalValue(mission.completed_at) === undefined ? {} : { completed_at: mission.completed_at }),
    currency: mission.currency,
    quotes_open_count: mission.quotes_summary.open_count,
    deliverables_count: mission.deliverables.length,
    ...(mission.order === null ? {} : { order_status: mission.order.status }),
  });
}

export const missionsOutputSchema = z.object({
  items: z.array(z.object({
    id: z.string(), title: z.string(), status: z.string(), mission_type: z.string(),
    area_hectares: z.number().optional(), deadline_at: z.string().optional(),
    published_at: z.string().optional(), version: z.number().int(),
  })),
  limit: z.number().int(),
  offset: z.number().int(),
});

export function toMissionsOutput(
  response: z.output<typeof oestMissionsResponseSchema>,
  input: z.output<typeof listMissionsInputSchema>,
) {
  return missionsOutputSchema.parse({
    items: response.data.map((mission) => ({
      id: asId(mission.id), title: mission.title, status: mission.status,
      mission_type: mission.mission_type,
      ...(optionalValue(mission.area_hectares) === undefined ? {} : { area_hectares: mission.area_hectares }),
      ...(optionalValue(mission.deadline_at) === undefined ? {} : { deadline_at: mission.deadline_at }),
      ...(optionalValue(mission.published_at) === undefined ? {} : { published_at: mission.published_at }),
      version: mission.version,
    })),
    limit: input.limit,
    offset: input.offset,
  });
}
