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

export const createMissionInputSchema = z
  .object({
    project_id: requiredIdentifierInputSchema,
    title: safeStringSchema.min(1).max(255),
    description: safeStringSchema.max(2000).optional(),
    mission_type: safeStringSchema.default("inspection"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    preferred_start_at: nullableTimestampSchema.optional(),
    deadline_at: nullableTimestampSchema.optional(),
    budget: z
      .object({
        min: nonNegativeNumberSchema.optional(),
        max: nonNegativeNumberSchema.optional(),
        currency: safeStringSchema.default("BRL"),
      })
      .optional(),
    idempotency_key: z.string().min(8).max(128).optional(),
    dry_run: z.boolean().default(false).optional(),
  })
  .strict();

export const createMissionResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        title: safeStringSchema,
        status: safeStringSchema,
        mission_type: safeStringSchema,
        area_hectares: nonNegativeNumberSchema.nullable().optional(),
        deadline_at: nullableTimestampSchema.optional(),
        published_at: nullableTimestampSchema.optional(),
        version: z.number().int().nonnegative().optional(),
        dry_run: z.boolean().optional(),
      })
      .strip(),
  })
  .strip();

export const publishMissionInputSchema = z
  .object({
    id: requiredIdentifierInputSchema,
    idempotency_key: z.string().min(8).max(128).optional(),
    dry_run: z.boolean().default(false).optional(),
  })
  .strict();

export const publishMissionResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        status: safeStringSchema,
        published_at: nullableTimestampSchema.optional(),
        matching_job_status: safeStringSchema.optional(),
        dry_run: z.boolean().optional(),
      })
      .strip(),
  })
  .strip();

export const updateOrderInputSchema = z
  .object({
    id: requiredIdentifierInputSchema,
    description: safeStringSchema.max(2000).optional(),
    delivery_deadline: nullableTimestampSchema.optional(),
    dry_run: z.boolean().default(false).optional(),
  })
  .strict();

export const updateOrderResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        order_name: safeStringSchema,
        status: safeStringSchema,
        delivery_deadline: nullableTimestampSchema.optional(),
        description: nullableSafeStringSchema.optional(),
        map_types: z.array(safeStringSchema).optional(),
        estimated_area_hectares: nonNegativeNumberSchema.nullable().optional(),
        quotes_count: z.number().int().nonnegative().optional(),
        deliverables_count: z.number().int().nonnegative().optional(),
        created_at: timestampSchema.optional(),
        updated_at: timestampSchema.optional(),
        dry_run: z.boolean().optional(),
      })
      .strip(),
  })
  .strip();

export const cancelOrderInputSchema = z
  .object({
    id: requiredIdentifierInputSchema,
    reason: safeStringSchema.max(500).optional(),
    dry_run: z.boolean().default(false).optional(),
  })
  .strict();

export const cancelOrderResponseSchema = z
  .object({
    data: z
      .object({
        id: identifierSchema,
        order_name: safeStringSchema,
        status: safeStringSchema,
        delivery_deadline: nullableTimestampSchema.optional(),
        description: nullableSafeStringSchema.optional(),
        quotes_count: z.number().int().nonnegative().optional(),
        deliverables_count: z.number().int().nonnegative().optional(),
        created_at: timestampSchema.optional(),
        updated_at: timestampSchema.optional(),
        dry_run: z.boolean().optional(),
      })
      .strip(),
  })
  .strip();
