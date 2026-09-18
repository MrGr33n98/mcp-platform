import type { ToolDefinition, ToolRegistry } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import {
  createOestEndpointMap,
  oestSharedEndpointMap,
  type OestEndpointMap,
} from "./endpoint-map.js";
import {
  parseOestAdapterConfig,
  type OestAdapterConfig,
  type ValidatedOestAdapterConfig,
} from "./config.js";
import { createOestSharedCapabilities, createOestSharedTools } from "./shared/shared-capabilities.js";
import { createCancelOrderTool } from "./tools/cancel-order.js";
import { createCreateMissionTool } from "./tools/create-mission.js";
import { createDeliverableSummaryTool } from "./tools/get-deliverable-summary.js";
import { createGetMissionTool } from "./tools/get-mission.js";
import { createMissionSummaryTool } from "./tools/get-mission-summary.js";
import { createOperatorSummaryTool } from "./tools/get-operator-summary.js";
import { createOrderSummaryTool } from "./tools/get-order-summary.js";
import { createOrganizationSummaryTool } from "./tools/get-organization-summary.js";
import { createPublishMissionTool } from "./tools/publish-mission.js";
import { createQuoteSummaryTool } from "./tools/get-quote-summary.js";
import { createListMissionsTool } from "./tools/list-missions.js";
import { createListOperatorsTool } from "./tools/list-operators.js";
import { createUpdateOrderTool } from "./tools/update-order.js";

export interface OestAdapter {
  readonly config: ValidatedOestAdapterConfig;
  readonly endpoints: OestEndpointMap;
  readonly tools: readonly ToolDefinition[];
  register(registry: ToolRegistry): void;
}

export function createOestAdapter(options: {
  readonly client: RailsApiClient;
  readonly config?: OestAdapterConfig;
}): OestAdapter {
  const config = parseOestAdapterConfig(options.config);
  const endpoints = createOestEndpointMap(config);
  const capabilities = createOestSharedCapabilities(oestSharedEndpointMap);
  const tools: readonly ToolDefinition[] = Object.freeze([
    ...createOestSharedTools({ client: options.client, capabilities }),
    createOrganizationSummaryTool({ client: options.client, endpoints }),
    createListMissionsTool({ client: options.client, endpoints }),
    createGetMissionTool({ client: options.client, endpoints }),
    createMissionSummaryTool({ client: options.client, endpoints }),
    createListOperatorsTool({ client: options.client, endpoints }),
    createOperatorSummaryTool({ client: options.client, endpoints }),
    createQuoteSummaryTool({ client: options.client, endpoints }),
    createOrderSummaryTool({ client: options.client, endpoints }),
    createDeliverableSummaryTool({ client: options.client, endpoints }),
    createCreateMissionTool({ client: options.client, endpoints }),
    createPublishMissionTool({ client: options.client, endpoints }),
    createUpdateOrderTool({ client: options.client, endpoints }),
    createCancelOrderTool({ client: options.client, endpoints }),
  ]);

  return Object.freeze({
    config,
    endpoints,
    tools,
    register(registry: ToolRegistry): void {
      for (const tool of tools) {
        registry.register(tool);
      }
    },
  });
}

export { createOestEndpointMap, oestSharedEndpointMap } from "./endpoint-map.js";
export { parseOestAdapterConfig, oestAdapterConfigSchema } from "./config.js";
export { createOestSharedCapabilities, createOestSharedTools } from "./shared/shared-capabilities.js";
export { createOrganizationSummaryTool } from "./tools/get-organization-summary.js";
export { createListMissionsTool } from "./tools/list-missions.js";
export { createGetMissionTool } from "./tools/get-mission.js";
export { createMissionSummaryTool } from "./tools/get-mission-summary.js";
export { createListOperatorsTool } from "./tools/list-operators.js";
export { createOperatorSummaryTool } from "./tools/get-operator-summary.js";
export { createQuoteSummaryTool } from "./tools/get-quote-summary.js";
export { createOrderSummaryTool } from "./tools/get-order-summary.js";
export { createDeliverableSummaryTool } from "./tools/get-deliverable-summary.js";
export { createCreateMissionTool } from "./tools/create-mission.js";
export { createPublishMissionTool } from "./tools/publish-mission.js";
export { createUpdateOrderTool } from "./tools/update-order.js";
export { createCancelOrderTool } from "./tools/cancel-order.js";
export * from "./schemas/mutations.js";
export type { OestAdapterConfig, ValidatedOestAdapterConfig } from "./config.js";
export type { OestEndpointMap } from "./endpoint-map.js";

