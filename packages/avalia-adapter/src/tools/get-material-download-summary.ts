import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { AvaliaEndpointMap } from "../endpoint-map.js";
import {
  getMaterialDownloadSummaryInputSchema,
  materialDownloadSummaryResponseSchema,
} from "../schemas/materials.js";

export interface GetMaterialDownloadSummaryToolOptions {
  readonly client: RailsApiClient;
  readonly endpointMap: AvaliaEndpointMap;
}

export function createGetMaterialDownloadSummaryTool(
  options: GetMaterialDownloadSummaryToolOptions,
): ToolDefinition<typeof getMaterialDownloadSummaryInputSchema> {
  return {
    name: "get_material_download_summary",
    description: "Returns aggregated educational and commercial material downloads and lead conversion metrics.",
    readOnly: true,
    riskLevel: "read",
    inputSchema: getMaterialDownloadSummaryInputSchema,
    async execute(context, input) {
      const query: Record<string, string> = {};
      if (input.company_id) query.company_id = input.company_id;
      if (input.period) query.period = input.period;

      const response = await options.client.get({
        path: options.endpointMap.materialDownloadsSummary,
        query,
        requestId: context.requestId,
        responseSchema: materialDownloadSummaryResponseSchema,
      });

      return response.data;
    },
  };
}
