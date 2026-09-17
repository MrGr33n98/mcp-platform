import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  missionIdentifierInputSchema,
  missionOutputSchema,
  oestMissionResponseSchema,
  toMissionOutput,
} from "../schemas/missions.js";

export function createGetMissionTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof missionIdentifierInputSchema> {
  return {
    name: "get_mission",
    description: "Get one authenticated OEST mission with safe workspace fields.",
    readOnly: true,
    inputSchema: missionIdentifierInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.mission(input.id),
        requestId: context.requestId,
        responseSchema: oestMissionResponseSchema,
      });
      return missionOutputSchema.parse(toMissionOutput(response));
    },
  };
}
