import {
  emptyObjectSchema,
  type ToolDefinition,
} from "@mcp-platform/core";
import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import {
  createSharedCapabilities,
  apiKeyUsageResponseSchema,
  subscriptionSummaryInputSchema,
  subscriptionSummaryResponseSchema,
  systemHealthInputSchema,
  systemHealthResponseSchema,
  usageSummaryResponseSchema,
  type SharedCapabilities,
  type SharedEndpointMap,
} from "@mcp-platform/shared-tools";
import { oestSharedEndpointMap } from "../endpoint-map.js";
import {
  oestApiKeysResponseSchema,
  oestHealthResponseSchema,
  oestPlanResponseSchema,
  oestUsageResponseSchema,
  oestUsageSummaryInputSchema,
  toOestApiKeyUsage,
  toOestSubscriptionSummary,
  toOestUsageSummary,
} from "../schemas/shared.js";

export function createOestSharedCapabilities(
  endpointMap: SharedEndpointMap = oestSharedEndpointMap,
): SharedCapabilities {
  return createSharedCapabilities(endpointMap);
}

export function createOestSharedTools(options: {
  readonly client: RailsApiClient;
  readonly capabilities?: SharedCapabilities;
}): readonly ToolDefinition[] {
  const capabilities = options.capabilities ?? createOestSharedCapabilities();

  const systemHealth: ToolDefinition<typeof systemHealthInputSchema> = {
    name: "get_system_health",
    description: "Get the OEST API health status reported by its health endpoint.",
    readOnly: true,
    inputSchema: systemHealthInputSchema,
    async execute(context) {
      const response = await options.client.get({
        path: capabilities.requireCapability("system_health"),
        requestId: context.requestId,
        responseSchema: oestHealthResponseSchema,
      });
      return systemHealthResponseSchema.parse({
        status: "healthy",
        checks: [{ name: "oest_api", status: "healthy" }],
        timestamp: response.time,
      });
    },
  };

  const subscription: ToolDefinition<typeof subscriptionSummaryInputSchema> = {
    name: "get_subscription_summary",
    description: "Get the OEST subscription plan summary without payment data.",
    readOnly: true,
    inputSchema: subscriptionSummaryInputSchema,
    async execute(context) {
      const response = await options.client.get({
        path: capabilities.requireCapability("subscription_summary"),
        requestId: context.requestId,
        responseSchema: oestPlanResponseSchema,
      });
      return subscriptionSummaryResponseSchema.parse(toOestSubscriptionSummary(response));
    },
  };

  const usage: ToolDefinition<typeof oestUsageSummaryInputSchema> = {
    name: "get_usage_summary",
    description: "Get the OEST current-period mission usage summary.",
    readOnly: true,
    inputSchema: oestUsageSummaryInputSchema,
    async execute(context) {
      const response = await options.client.get({
        path: capabilities.requireCapability("usage_summary"),
        requestId: context.requestId,
        responseSchema: oestUsageResponseSchema,
      });
      return usageSummaryResponseSchema.parse(toOestUsageSummary(response));
    },
  };

  const apiKeys: ToolDefinition<typeof emptyObjectSchema> = {
    name: "get_api_key_usage",
    description: "List OEST API-key usage metadata without key material.",
    readOnly: true,
    inputSchema: emptyObjectSchema,
    async execute(context) {
      const response = await options.client.get({
        path: capabilities.requireCapability("api_key_usage"),
        requestId: context.requestId,
        responseSchema: oestApiKeysResponseSchema,
      });
      return apiKeyUsageResponseSchema.parse(toOestApiKeyUsage(response));
    },
  };

  return Object.freeze([systemHealth, subscription, usage, apiKeys]);
}
