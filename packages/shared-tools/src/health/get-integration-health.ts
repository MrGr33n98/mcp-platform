import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import {
  integrationHealthInputSchema,
  integrationHealthResponseSchema,
  type IntegrationHealth,
} from "./schemas.js";

export function createIntegrationHealthTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof integrationHealthInputSchema, IntegrationHealth> {
  return {
    name: "get_integration_health",
    description: "Get safe status information for configured integrations.",
    readOnly: true,
    inputSchema: integrationHealthInputSchema,
    execute(context, input) {
      return options.client.get({
        path: options.capabilities.requireCapability("integration_health"),
        ...(input.integration === undefined
          ? {}
          : { query: { integration: input.integration } }),
        requestId: context.requestId,
        responseSchema: integrationHealthResponseSchema,
      });
    },
  };
}
