import { z } from "zod";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 100;

export const paginationInputSchema = z
  .object({
    page: z.number().int().min(1).max(10_000).default(DEFAULT_PAGE),
    per_page: z.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
  })
  .strict();

export type PaginationInput = z.output<typeof paginationInputSchema>;

export const paginationOutputSchema = z
  .object({
    page: z.number().int().min(1),
    per_page: z.number().int().min(1).max(MAX_PER_PAGE),
    total: z.number().int().min(0).optional(),
  })
  .strict();

export type PaginationOutput = z.output<typeof paginationOutputSchema>;

export function toPaginationQuery(input: PaginationInput): {
  readonly page: number;
  readonly per_page: number;
} {
  return { page: input.page, per_page: input.per_page };
}
