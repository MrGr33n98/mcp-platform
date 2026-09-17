import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  oestOrderResponseSchema,
  orderIdentifierInputSchema,
  orderSummaryOutputSchema,
  toOrderSummary,
} from "../schemas/commerce.js";

export function createOrderSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof orderIdentifierInputSchema> {
  return {
    name: "get_order_summary",
    description: "Get one authenticated OEST order summary.",
    readOnly: true,
    inputSchema: orderIdentifierInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.order(input.id),
        requestId: context.requestId,
        responseSchema: oestOrderResponseSchema,
      });
      return orderSummaryOutputSchema.parse(toOrderSummary(response));
    },
  };
}
