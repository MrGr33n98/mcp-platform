import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { AvaliaEndpointMap } from "../endpoint-map.js";
import {
  getReviewSummaryInputSchema,
  reviewSummaryResponseSchema,
} from "../schemas/reviews.js";

export interface GetReviewSummaryToolOptions {
  readonly client: RailsApiClient;
  readonly endpointMap: AvaliaEndpointMap;
}

export function createGetReviewSummaryTool(
  options: GetReviewSummaryToolOptions,
): ToolDefinition<typeof getReviewSummaryInputSchema> {
  return {
    name: "get_review_summary",
    description: "Returns aggregated review ratings, NPS, sentiment and score distribution for solar installations.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getReviewSummaryInputSchema,
    async execute(context, input) {
      const query: Record<string, string> = {};
      if (input.company_id) query.company_id = input.company_id;
      if (input.period) query.period = input.period;

      const response = await options.client.get({
        path: options.endpointMap.reviewsSummary,
        query,
        requestId: context.requestId,
        responseSchema: reviewSummaryResponseSchema,
      });

      return response.data;
    },
  };
}
