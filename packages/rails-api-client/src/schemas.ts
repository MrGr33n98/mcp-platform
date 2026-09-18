import type { z } from "zod";

export type RailsApiQueryValue = string | number | boolean | undefined;

export type RailsApiQuery = Readonly<Record<string, RailsApiQueryValue>>;

export type RailsApiRequestSchema<TRequest> = z.ZodType<TRequest>;

export type RailsApiResponseSchema<TResponse> = z.ZodType<TResponse>;

