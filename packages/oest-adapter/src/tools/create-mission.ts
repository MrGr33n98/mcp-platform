import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  createMissionInputSchema,
  createMissionResponseSchema,
} from "../schemas/mutations.js";

export function createCreateMissionTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof createMissionInputSchema> {
  return {
    name: "create_mission",
    description: "Create a new mission draft associated with a project in the authenticated enterprise organization.",
    readOnly: false,
    riskLevel: "write",
    inputSchema: createMissionInputSchema,
    async execute(context, input) {
      if (input.dry_run) {
        return {
          id: "simulated-preview-id",
          title: input.title,
          status: "draft_preview",
          mission_type: input.mission_type,
          version: 0,
          dry_run: true,
        };
      }

      const { idempotency_key, dry_run: _dryRun, ...body } = input;
      const response = await options.client.post({
        path: options.endpoints.missions,
        body,
        requestId: context.requestId,
        idempotencyKey: idempotency_key,
        responseSchema: createMissionResponseSchema,
      });
      return response.data;
    },
  };
}
