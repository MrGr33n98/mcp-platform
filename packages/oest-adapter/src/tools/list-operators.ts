import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  listOperatorsInputSchema,
  oestOperatorsResponseSchema,
  toOperatorsOutput,
} from "../schemas/operators.js";

export function createListOperatorsTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof listOperatorsInputSchema> {
  return {
    name: "list_operators",
    description: "List public OEST marketplace operator summaries.",
    readOnly: true,
    inputSchema: listOperatorsInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.operators,
        query: { limit: input.limit },
        requestId: context.requestId,
        responseSchema: oestOperatorsResponseSchema,
      });
      return toOperatorsOutput(response, input);
    },
  };
}
