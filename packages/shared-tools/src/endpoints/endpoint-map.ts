import { McpPlatformError } from "@mcp-platform/core";
import { z } from "zod";
import type { SharedCapability } from "../capabilities/shared-capabilities.js";

const endpointPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (path) =>
      path.startsWith("/api/") &&
      !path.startsWith("//") &&
      !path.includes("\\") &&
      !path.includes("?") &&
      !path.includes("#"),
    "Endpoint paths must be safe relative API paths.",
  );

export const sharedEndpointMapSchema = z
  .object({
    systemHealth: endpointPathSchema.optional(),
    integrationHealth: endpointPathSchema.optional(),
    subscriptionSummary: endpointPathSchema.optional(),
    usageSummary: endpointPathSchema.optional(),
    failedWebhooks: endpointPathSchema.optional(),
    apiKeyUsage: endpointPathSchema.optional(),
  })
  .strict();

export type SharedEndpointMap = z.output<typeof sharedEndpointMapSchema>;

export function parseSharedEndpointMap(input: unknown): SharedEndpointMap {
  const parsed = sharedEndpointMapSchema.safeParse(input);
  if (!parsed.success) {
    throw new McpPlatformError({
      code: "INVALID_SHARED_ENDPOINT_MAP",
      message: "Shared tool endpoint configuration is invalid.",
      retryable: false,
    });
  }

  return parsed.data;
}

export function endpointForCapability(
  endpointMap: SharedEndpointMap,
  capability: SharedCapability,
): string | undefined {
  switch (capability) {
    case "system_health":
      return endpointMap.systemHealth;
    case "integration_health":
      return endpointMap.integrationHealth;
    case "subscription_summary":
      return endpointMap.subscriptionSummary;
    case "usage_summary":
      return endpointMap.usageSummary;
    case "failed_webhooks":
      return endpointMap.failedWebhooks;
    case "api_key_usage":
      return endpointMap.apiKeyUsage;
  }
}
