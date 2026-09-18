import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { AvaliaEndpointMap } from "../endpoint-map.js";
import {
  getLeadSummaryInputSchema,
  leadSummaryResponseSchema,
} from "../schemas/leads.js";

export interface GetLeadSummaryToolOptions {
  readonly client: RailsApiClient;
  readonly endpointMap: AvaliaEndpointMap;
}

export function createGetLeadSummaryTool(
  options: GetLeadSummaryToolOptions,
): ToolDefinition<typeof getLeadSummaryInputSchema> {
  return {
    name: "get_lead_summary",
    description: "Returns aggregated lead acquisition metrics, stages, and conversion rates with strict PII minimization.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getLeadSummaryInputSchema,
    async execute(context, input) {
      const query: Record<string, string> = {};
      if (input.company_id) query.company_id = input.company_id;
      if (input.period) query.period = input.period;
      if (input.source) query.source = input.source;

      const response = await options.client.get({
        path: options.endpointMap.leadsSummary,
        query,
        requestId: context.requestId,
        responseSchema: leadSummaryResponseSchema,
      });

      return response.data;
    },
  };
}
