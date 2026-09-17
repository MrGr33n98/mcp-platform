import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import {
  subscriptionSummaryInputSchema,
  subscriptionSummaryResponseSchema,
  type SubscriptionSummary,
} from "./schemas.js";

export function createSubscriptionSummaryTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof subscriptionSummaryInputSchema, SubscriptionSummary> {
  return {
    name: "get_subscription_summary",
    description: "Get the product's safe subscription summary.",
    readOnly: true,
    inputSchema: subscriptionSummaryInputSchema,
    execute(context) {
      return options.client.get({
        path: options.capabilities.requireCapability("subscription_summary"),
        requestId: context.requestId,
        responseSchema: subscriptionSummaryResponseSchema,
      });
    },
  };
}
