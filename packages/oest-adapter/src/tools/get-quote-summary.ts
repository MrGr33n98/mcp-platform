import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  missionIdentifierInputSchema,
  oestQuoteComparisonResponseSchema,
  quoteSummaryOutputSchema,
  toQuoteSummary,
} from "../schemas/commerce.js";

export function createQuoteSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof missionIdentifierInputSchema> {
  return {
    name: "get_quote_summary",
    description: "Get the safe quote comparison summary for an authenticated OEST mission.",
    readOnly: true,
    inputSchema: missionIdentifierInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.quoteComparison(input.id),
        requestId: context.requestId,
        responseSchema: oestQuoteComparisonResponseSchema,
      });
      return quoteSummaryOutputSchema.parse(toQuoteSummary(response));
    },
  };
}
