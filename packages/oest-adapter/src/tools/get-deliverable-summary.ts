import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  deliverableSummaryOutputSchema,
  missionIdentifierInputSchema,
  oestDeliverablesResponseSchema,
  toDeliverableSummary,
} from "../schemas/commerce.js";

export function createDeliverableSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof missionIdentifierInputSchema> {
  return {
    name: "get_deliverable_summary",
    description: "List safe deliverable metadata for an authenticated OEST mission.",
    readOnly: true,
    inputSchema: missionIdentifierInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.deliverables(input.id),
        requestId: context.requestId,
        responseSchema: oestDeliverablesResponseSchema,
      });
      return deliverableSummaryOutputSchema.parse(toDeliverableSummary(response));
    },
  };
}
