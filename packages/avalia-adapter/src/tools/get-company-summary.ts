import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { AvaliaEndpointMap } from "../endpoint-map.js";
import {
  companySummaryResponseSchema,
  getCompanySummaryInputSchema,
} from "../schemas/company.js";

export interface GetCompanySummaryToolOptions {
  readonly client: RailsApiClient;
  readonly endpointMap: AvaliaEndpointMap;
}

export function createGetCompanySummaryTool(
  options: GetCompanySummaryToolOptions,
): ToolDefinition<typeof getCompanySummaryInputSchema> {
  return {
    name: "get_company_summary",
    description: "Returns aggregated profile, stage, rating and metrics for a solar installation company.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getCompanySummaryInputSchema,
    async execute(context, input) {
      const path = options.endpointMap.companySummary.replace("{id}", encodeURIComponent(input.company_id));
      const response = await options.client.get({
        path,
        requestId: context.requestId,
        responseSchema: companySummaryResponseSchema,
      });

      return response.data;
    },
  };
}
