import type { SharedEndpointMap } from "@mcp-platform/shared-tools";

export interface AvaliaEndpointMap {
  readonly companySummary: string;
  readonly reviewsSummary: string;
  readonly leadsSummary: string;
  readonly salesPipeline: string;
  readonly materialDownloadsSummary: string;
  readonly shared: SharedEndpointMap;
}

export const defaultAvaliaEndpointMap: AvaliaEndpointMap = {
  companySummary: "/api/v1/companies/{id}/summary",
  reviewsSummary: "/api/v1/reviews/summary",
  leadsSummary: "/api/v1/leads/summary",
  salesPipeline: "/api/v1/sales/pipeline",
  materialDownloadsSummary: "/api/v1/materials/download-summary",
  shared: {
    systemHealth: "/health",
    subscriptionSummary: "/api/v1/enterprise/subscription",
    usageSummary: "/api/v1/enterprise/usage",
    apiKeyUsage: "/api/v1/enterprise/api_keys/usage",
  },
};
