import { McpPlatformError } from "@mcp-platform/core";
import { z } from "zod";

export const oestDashboardKinds = ["enterprise", "operator"] as const;

export const oestAdapterConfigSchema = z
  .object({
    dashboardKind: z.enum(oestDashboardKinds).default("enterprise"),
  })
  .strict();

export type OestAdapterConfig = z.input<typeof oestAdapterConfigSchema>;
export type ValidatedOestAdapterConfig = z.output<typeof oestAdapterConfigSchema>;

export function parseOestAdapterConfig(
  input: unknown = {},
): ValidatedOestAdapterConfig {
  const parsed = oestAdapterConfigSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpPlatformError({
      code: "INVALID_OEST_ADAPTER_CONFIG",
      message: "OEST adapter configuration is invalid.",
      retryable: false,
    });
  }

  return parsed.data;
}
