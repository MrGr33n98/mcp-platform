import type { RailsApiClient } from "@mcp-platform/rails-api-client";
import { McpPlatformError } from "@mcp-platform/core";
import {
  endpointForCapability,
  parseSharedEndpointMap,
  type SharedEndpointMap,
} from "../endpoints/endpoint-map.js";

export const sharedCapabilityValues = [
  "system_health",
  "integration_health",
  "subscription_summary",
  "usage_summary",
  "failed_webhooks",
  "api_key_usage",
] as const;

export type SharedCapability = (typeof sharedCapabilityValues)[number];

export interface SharedCapabilities {
  hasCapability(capability: SharedCapability): boolean;
  requireCapability(capability: SharedCapability): string;
}

export interface SharedToolFactoryOptions {
  readonly client: RailsApiClient;
  readonly capabilities: SharedCapabilities;
}

export function createSharedCapabilities(endpointMap: unknown): SharedCapabilities {
  const validatedEndpointMap = parseSharedEndpointMap(endpointMap);

  return Object.freeze({
    hasCapability(capability: SharedCapability): boolean {
      return hasCapability(validatedEndpointMap, capability);
    },
    requireCapability(capability: SharedCapability): string {
      return requireCapability(validatedEndpointMap, capability);
    },
  });
}

export function hasCapability(
  endpointMap: SharedEndpointMap,
  capability: SharedCapability,
): boolean {
  return endpointForCapability(endpointMap, capability) !== undefined;
}

export function requireCapability(
  endpointMap: SharedEndpointMap,
  capability: SharedCapability,
): string {
  const endpoint = endpointForCapability(endpointMap, capability);
  if (endpoint === undefined) {
    throw new McpPlatformError({
      code: "CAPABILITY_NOT_AVAILABLE",
      message: "This product does not provide the requested shared capability.",
      retryable: false,
    });
  }

  return endpoint;
}
