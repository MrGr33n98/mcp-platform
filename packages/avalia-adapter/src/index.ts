import type { ToolDefinition, ToolRegistry } from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import {
  createApiKeyUsageTool,
  createSharedCapabilities,
  createSubscriptionSummaryTool,
  createSystemHealthTool,
  createUsageSummaryTool,
  type SharedCapabilities,
} from "@mcp-platform/shared-tools";
import {
  defaultAvaliaEndpointMap,
  type AvaliaEndpointMap,
} from "./endpoint-map.js";
import {
  parseAvaliaAdapterConfig,
  type AvaliaAdapterConfig,
} from "./config.js";
import { createGetCompanySummaryTool } from "./tools/get-company-summary.js";
import { createGetReviewSummaryTool } from "./tools/get-review-summary.js";
import { createGetLeadSummaryTool } from "./tools/get-lead-summary.js";
import { createGetSalesPipelineTool } from "./tools/get-sales-pipeline.js";
import { createGetMaterialDownloadSummaryTool } from "./tools/get-material-download-summary.js";

export interface AvaliaAdapterOptions {
  readonly client: RailsApiClient;
  readonly config?: AvaliaAdapterConfig;
  readonly endpointMap?: Partial<AvaliaEndpointMap>;
}

export interface AvaliaAdapter {
  readonly name: string;
  readonly tools: readonly ToolDefinition[];
  register(registry: ToolRegistry): void;
}

export function createAvaliaAdapter(options: AvaliaAdapterOptions): AvaliaAdapter {
  const endpointMap: AvaliaEndpointMap = {
    ...defaultAvaliaEndpointMap,
    ...options.endpointMap,
    shared: {
      ...defaultAvaliaEndpointMap.shared,
      ...options.endpointMap?.shared,
    },
  };

  const capabilities: SharedCapabilities = createSharedCapabilities(endpointMap.shared);

  const sharedTools: ToolDefinition[] = options.config?.enableSharedTools !== false
    ? [
        createSystemHealthTool({ client: options.client, capabilities }),
        createSubscriptionSummaryTool({ client: options.client, capabilities }),
        createUsageSummaryTool({ client: options.client, capabilities }),
        createApiKeyUsageTool({ client: options.client, capabilities }),
      ]
    : [];

  const avaliaTools: ToolDefinition[] = [
    createGetCompanySummaryTool({ client: options.client, endpointMap }),
    createGetReviewSummaryTool({ client: options.client, endpointMap }),
    createGetLeadSummaryTool({ client: options.client, endpointMap }),
    createGetSalesPipelineTool({ client: options.client, endpointMap }),
    createGetMaterialDownloadSummaryTool({ client: options.client, endpointMap }),
  ];

  const tools: readonly ToolDefinition[] = [...sharedTools, ...avaliaTools];

  return {
    name: "avalia-adapter",
    tools,
    register(registry: ToolRegistry): void {
      for (const tool of tools) {
        registry.register(tool);
      }
    },
  };
}

export { defaultAvaliaEndpointMap, type AvaliaEndpointMap } from "./endpoint-map.js";
export { parseAvaliaAdapterConfig, type AvaliaAdapterConfig } from "./config.js";
