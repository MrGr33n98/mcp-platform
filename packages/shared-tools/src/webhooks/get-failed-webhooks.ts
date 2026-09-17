import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import { toPaginationQuery } from "../pagination/pagination.js";
import {
  failedWebhooksInputSchema,
  failedWebhooksResponseSchema,
  type FailedWebhooks,
} from "./schemas.js";

export function createFailedWebhooksTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof failedWebhooksInputSchema, FailedWebhooks> {
  return {
    name: "get_failed_webhooks",
    description: "List safe metadata for failed webhook deliveries.",
    readOnly: true,
    inputSchema: failedWebhooksInputSchema,
    execute(context, input) {
      return options.client.get({
        path: options.capabilities.requireCapability("failed_webhooks"),
        query: toPaginationQuery(input),
        requestId: context.requestId,
        responseSchema: failedWebhooksResponseSchema,
      });
    },
  };
}
