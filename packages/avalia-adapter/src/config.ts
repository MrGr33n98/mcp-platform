import { z } from "zod";

export const avaliaAdapterConfigSchema = z.object({
  environment: z.enum(["development", "staging", "production"]).default("production"),
  enableSharedTools: z.boolean().default(true),
});

export type AvaliaAdapterConfig = z.infer<typeof avaliaAdapterConfigSchema>;

export function parseAvaliaAdapterConfig(raw: unknown): AvaliaAdapterConfig {
  return avaliaAdapterConfigSchema.parse(raw);
}
