import { z } from "zod";
import { logLevels, type LogLevel } from "../logging/logger.js";

export const mcpConfigSchema = z
  .object({
    MCP_PRODUCT_ID: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z][a-z0-9-]*$/),
    MCP_PRODUCT_NAME: z.string().trim().min(1),
    MCP_LOG_LEVEL: z.enum(logLevels).default("info"),
    MCP_VERSION: z.string().trim().min(1).optional().default("0.1.0"),
  })
  .transform((value) => ({
    productId: value.MCP_PRODUCT_ID,
    productName: value.MCP_PRODUCT_NAME,
    logLevel: value.MCP_LOG_LEVEL as LogLevel,
    version: value.MCP_VERSION,
    transport: "stdio" as const,
    readOnly: true as const,
  }));

export type McpConfig = z.output<typeof mcpConfigSchema>;
