import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import { emptyObjectSchema } from "@mcp-platform/core";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  oestDashboardResponseSchema,
  organizationSummaryOutputSchema,
  toOrganizationSummary,
} from "../schemas/organization.js";

export function createOrganizationSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof emptyObjectSchema> {
  return {
    name: "get_organization_summary",
    description: "Get the authenticated OEST organization dashboard summary.",
    readOnly: true,
    inputSchema: emptyObjectSchema,
    async execute(context) {
      const response = await options.client.get({
        path: options.endpoints.organizationSummary,
        requestId: context.requestId,
        responseSchema: oestDashboardResponseSchema,
      });
      return organizationSummaryOutputSchema.parse(toOrganizationSummary(response));
    },
  };
}
