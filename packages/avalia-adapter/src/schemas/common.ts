import { z } from "zod";

export const identifierSchema = z.union([z.string().trim().min(1).max(128), z.number().int().nonnegative()]);
export const requiredIdentifierInputSchema = z.string().trim().min(1).max(128);
export const safeStringSchema = z.string().trim().min(1).max(4_000);
export const nullableSafeStringSchema = safeStringSchema.nullable();
export const nonNegativeNumberSchema = z.coerce.number().finite().nonnegative();
export const timestampSchema = z.string().datetime({ offset: true });
export const nullableTimestampSchema = timestampSchema.nullable();
export const periodInputSchema = z.enum(["7d", "30d", "90d", "12m", "all"]).default("30d");

export function asId(value: z.output<typeof identifierSchema>): string {
  return String(value);
}
