import { z } from "zod";

export const identifierSchema = z.union([z.string().trim().min(1).max(128), z.number().int().nonnegative()]);
export const requiredIdentifierInputSchema = z.string().trim().min(1).max(128);
export const slugInputSchema = z.string().trim().min(1).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const nullableTimestampSchema = timestampSchema.nullable();
export const safeStringSchema = z.string().trim().min(1).max(4_000);
export const nullableSafeStringSchema = safeStringSchema.nullable();
export const nonNegativeNumberSchema = z.coerce.number().finite().nonnegative();

export function asId(value: z.output<typeof identifierSchema>): string {
  return String(value);
}

export function optionalValue<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}
