import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  updateOrderInputSchema,
  updateOrderResponseSchema,
} from "../schemas/mutations.js";

export function createUpdateOrderTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof updateOrderInputSchema> {
  return {
    name: "update_order",
    description: "Update details (description, deadline) of an active enterprise order in the authenticated organization.",
    readOnly: false,
    riskLevel: "write",
    inputSchema: updateOrderInputSchema,
    async execute(context, input) {
      if (input.dry_run) {
        return {
          id: input.id,
          order_name: "simulated-order",
          status: "updated_preview",
          description: input.description,
          delivery_deadline: input.delivery_deadline,
          dry_run: true,
        };
      }

      const { id, dry_run: _dryRun, ...body } = input;
      const response = await options.client.patch({
        path: options.endpoints.updateOrder(id),
        body,
        requestId: context.requestId,
        responseSchema: updateOrderResponseSchema,
      });
      return response.data;
    },
  };
}
