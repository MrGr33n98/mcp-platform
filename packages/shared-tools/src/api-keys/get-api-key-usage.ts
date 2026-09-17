import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import {
  apiKeyUsageInputSchema,
  apiKeyUsageResponseSchema,
  type ApiKeyUsage,
} from "./schemas.js";

export function createApiKeyUsageTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof apiKeyUsageInputSchema, ApiKeyUsage> {
  return {
    name: "get_api_key_usage",
    description: "List safe API key usage metadata without key material.",
    readOnly: true,
    inputSchema: apiKeyUsageInputSchema,
    execute(context) {
      return options.client.get({
        path: options.capabilities.requireCapability("api_key_usage"),
        requestId: context.requestId,
        responseSchema: apiKeyUsageResponseSchema,
      });
    },
  };
}
