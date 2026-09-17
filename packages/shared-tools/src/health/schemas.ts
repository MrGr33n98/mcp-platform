import { emptyObjectSchema } from "@mcp-platform/core";
import { z } from "zod";

const healthStatusSchema = z.enum(["healthy", "degraded", "unhealthy"]);
const logicalNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9_-]*$/);
const unsafeDiagnosticPattern =
  /:\/\/|\b(?:authorization|bearer|api[_-]?key|token|password|secret|cookie|stack(?:\s+trace)?|environment|env|postgres(?:ql)?|redis)\b|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i;
const safeMessageSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine(
    (message) => !unsafeDiagnosticPattern.test(message),
    "Health messages must not contain sensitive diagnostics.",
  );
const timestampSchema = z.string().datetime({ offset: true });

export const systemHealthInputSchema = emptyObjectSchema;

export const healthCheckSchema = z
  .object({
    name: logicalNameSchema,
    status: healthStatusSchema,
    message: safeMessageSchema.optional(),
  })
  .strict();

export const systemHealthResponseSchema = z
  .object({
    status: healthStatusSchema,
    checks: z.array(healthCheckSchema).max(100),
    timestamp: timestampSchema.optional(),
  })
  .strict();

export type SystemHealth = z.output<typeof systemHealthResponseSchema>;

export const integrationHealthInputSchema = z
  .object({
    integration: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[a-z][a-z0-9_-]*$/)
      .optional(),
  })
  .strict();

export const integrationHealthItemSchema = z
  .object({
    name: logicalNameSchema,
    status: healthStatusSchema,
    message: safeMessageSchema.optional(),
  })
  .strict();

export const integrationHealthResponseSchema = z
  .object({
    integrations: z.array(integrationHealthItemSchema).max(100),
  })
  .strict();

export type IntegrationHealth = z.output<typeof integrationHealthResponseSchema>;
