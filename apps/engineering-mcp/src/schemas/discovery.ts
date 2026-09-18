import { z } from "zod";
import { emptyObjectSchema } from "@mcp-platform/core";

export const getPlatformInfoInputSchema = emptyObjectSchema;

export const listCapabilitiesInputSchema = z
  .object({
    filter_engine: z.string().trim().optional(),
    filter_risk: z.enum(["READ", "PLAN", "WRITE", "HIGH_RISK"]).optional(),
  })
  .strict();
