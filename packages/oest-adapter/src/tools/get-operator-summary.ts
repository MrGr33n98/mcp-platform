import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  oestOperatorProfileResponseSchema,
  operatorSlugInputSchema,
  operatorSummaryOutputSchema,
  toOperatorSummary,
} from "../schemas/operators.js";

export function createOperatorSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof operatorSlugInputSchema> {
  return {
    name: "get_operator_summary",
    description: "Get a safe public OEST marketplace operator summary.",
    readOnly: true,
    inputSchema: operatorSlugInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.operator(input.slug),
        requestId: context.requestId,
        responseSchema: oestOperatorProfileResponseSchema,
      });
      return operatorSummaryOutputSchema.parse(toOperatorSummary(response));
    },
  };
}
