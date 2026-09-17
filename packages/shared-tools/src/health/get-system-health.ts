import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import {
  systemHealthInputSchema,
  systemHealthResponseSchema,
  type SystemHealth,
} from "./schemas.js";

export function createSystemHealthTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof systemHealthInputSchema, SystemHealth> {
  return {
    name: "get_system_health",
    description: "Get the product's safe system health summary.",
    readOnly: true,
    inputSchema: systemHealthInputSchema,
    execute(context) {
      return options.client.get({
        path: options.capabilities.requireCapability("system_health"),
        requestId: context.requestId,
        responseSchema: systemHealthResponseSchema,
      });
    },
  };
}
