import type { ToolDefinition } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import type { OestEndpointMap } from "../endpoint-map.js";
import {
  publishMissionInputSchema,
  publishMissionResponseSchema,
} from "../schemas/mutations.js";

export function createPublishMissionTool(options: {
  readonly client: RailsApiClient;
  readonly endpoints: OestEndpointMap;
}): ToolDefinition<typeof publishMissionInputSchema> {
  return {
    name: "publish_mission",
    description: "Publish a prepared mission draft to the marketplace for matching with qualified drone operators.",
    readOnly: false,
    riskLevel: "write",
    inputSchema: publishMissionInputSchema,
    async execute(context, input) {
      if (input.dry_run) {
        return {
          id: input.id,
          status: "published_preview",
          matching_job_status: "simulated_queued",
          dry_run: true,
        };
      }

      const response = await options.client.post({
        path: options.endpoints.publishMission(input.id),
        requestId: context.requestId,
        idempotencyKey: input.idempotency_key,
        responseSchema: publishMissionResponseSchema,
      });
      return response.data;
    },
  };
}
