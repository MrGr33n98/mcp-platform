import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  listMissionsInputSchema,
  oestMissionsResponseSchema,
  toMissionsOutput,
} from "../schemas/missions.js";

export function createListMissionsTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof listMissionsInputSchema> {
  return {
    name: "list_missions",
    description: "List authenticated OEST missions using bounded pagination.",
    readOnly: true,
    inputSchema: listMissionsInputSchema,
    async execute(context, input) {
      const response = await options.client.get({
        path: options.endpoints.missions,
        query: { limit: input.limit, offset: input.offset },
        requestId: context.requestId,
        responseSchema: oestMissionsResponseSchema,
      });
      return toMissionsOutput(response, input);
    },
  };
}
