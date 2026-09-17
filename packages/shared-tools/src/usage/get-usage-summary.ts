import type { ToolDefinition } from "@mcp-platform/core";
import type { SharedToolFactoryOptions } from "../capabilities/shared-capabilities.js";
import {
  usageSummaryInputSchema,
  usageSummaryResponseSchema,
  type UsageSummary,
} from "./schemas.js";

export function createUsageSummaryTool(
  options: SharedToolFactoryOptions,
): ToolDefinition<typeof usageSummaryInputSchema, UsageSummary> {
  return {
    name: "get_usage_summary",
    description: "Get safe product usage metrics for an allowed period.",
    readOnly: true,
    inputSchema: usageSummaryInputSchema,
    execute(context, input) {
      return options.client.get({
        path: options.capabilities.requireCapability("usage_summary"),
        ...(input.period === undefined ? {} : { query: { period: input.period } }),
        requestId: context.requestId,
        responseSchema: usageSummaryResponseSchema,
      });
    },
  };
}
