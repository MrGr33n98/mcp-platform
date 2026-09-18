import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  cancelOrderInputSchema,
  cancelOrderResponseSchema,
} from "../schemas/mutations.js";

export function createCancelOrderTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof cancelOrderInputSchema> {
  return {
    name: "cancel_order",
    description: "Cancel an active enterprise order. SENSITIVE: This immediately terminates mission matching/execution and records a status event.",
    readOnly: false,
    riskLevel: "sensitive",
    inputSchema: cancelOrderInputSchema,
    async execute(context, input) {
      if (input.dry_run) {
        return {
          id: input.id,
          order_name: "simulated-order",
          status: "cancelled_preview",
          description: input.reason,
          dry_run: true,
        };
      }

      const { id, reason } = input;
      const response = await options.client.post({
        path: options.endpoints.cancelOrder(id),
        body: reason !== undefined ? { reason } : {},
        requestId: context.requestId,
        responseSchema: cancelOrderResponseSchema,
      });
      return response.data;
    },
  };
}
