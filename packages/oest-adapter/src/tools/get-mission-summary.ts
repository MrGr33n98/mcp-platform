import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  missionIdentifierInputSchema,
  missionSummaryOutputSchema,
  oestMissionResponseSchema,
  toMissionSummary,
} from "../schemas/missions.js";

export function createMissionSummaryTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof missionIdentifierInputSchema> {
  return {
    name: "get_mission_summary",
    description: "Get a safe OEST mission summary from the existing mission endpoint.",
    readOnly: true,
    inputSchema: missionIdentifierInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.mission(input.id),
        requestId: context.requestId,
        responseSchema: oestMissionResponseSchema,
      });
      return missionSummaryOutputSchema.parse(toMissionSummary(response));
    },
  };
}
