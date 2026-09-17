import type { McpConfig } from "../config/config-schema.js";
import { emptyObjectSchema } from "../schemas/common.js";
import type { ToolDefinition } from "./tool-definition.js";

export interface PlatformInfo {
  readonly platform: "MCP Platform";
  readonly version: string;
  readonly product_id: string;
  readonly product_name: string;
  readonly transport: "stdio";
  readonly read_only: true;
}

export function createPlatformInfoTool(
  config: McpConfig,
): ToolDefinition<typeof emptyObjectSchema, PlatformInfo> {
  return {
    name: "get_platform_info",
    description: "Get safe MCP Platform identity and runtime metadata.",
    readOnly: true,
    inputSchema: emptyObjectSchema,
    execute() {
      return {
        platform: "MCP Platform",
        version: config.version,
        product_id: config.productId,
        product_name: config.productName,
        transport: config.transport,
        read_only: config.readOnly,
      };
    },
  };
}
