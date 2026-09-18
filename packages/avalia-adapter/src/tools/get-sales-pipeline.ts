import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { AvaliaEndpointMap } from "../endpoint-map.js";
import {
  getSalesPipelineInputSchema,
  salesPipelineResponseSchema,
} from "../schemas/sales.js";

export interface GetSalesPipelineToolOptions {
  readonly client: RailsApiClient;
  readonly endpointMap: AvaliaEndpointMap;
}

export function createGetSalesPipelineTool(
  options: GetSalesPipelineToolOptions,
): ToolDefinition<typeof getSalesPipelineInputSchema> {
  return {
    name: "get_sales_pipeline",
    description: "Returns aggregated commercial pipeline funnel, stages and authorized deal values.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getSalesPipelineInputSchema,
    async execute(context, input) {
      const query: Record<string, string> = {};
      if (input.company_id) query.company_id = input.company_id;
      if (input.period) query.period = input.period;

      const response = await options.client.get({
        path: options.endpointMap.salesPipeline,
        query,
        requestId: context.requestId,
        responseSchema: salesPipelineResponseSchema,
      });

      return response.data;
    },
  };
}
