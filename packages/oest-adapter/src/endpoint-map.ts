import type { SharedEndpointMap } from "@mcp-platform/shared-tools";
import type { ValidatedOestAdapterConfig } from "./config.js";

export const oestSharedEndpointMap = {
  systemHealth: "/health",
  subscriptionSummary: "/api/v1/billing/plan",
  usageSummary: "/api/v1/billing/usage",
  apiKeyUsage: "/api/v1/enterprise/api_keys",
} as const satisfies SharedEndpointMap;

export interface OestEndpointMap {
  readonly organizationSummary:
    | "/api/v1/enterprise/dashboard"
    | "/api/v1/operator/dashboard";
  readonly missions: "/api/v1/missions";
  mission(id: string): string;
  publishMission(id: string): string;
  readonly operators: "/api/v1/marketplace/operators";
  operator(slug: string): string;
  quoteComparison(id: string): string;
  order(id: string): string;
  updateOrder(id: string): string;
  cancelOrder(id: string): string;
  deliverables(id: string): string;
}

export function createOestEndpointMap(
  config: ValidatedOestAdapterConfig,
): OestEndpointMap {
  return Object.freeze({
    organizationSummary:
      config.dashboardKind === "enterprise"
        ? "/api/v1/enterprise/dashboard"
        : "/api/v1/operator/dashboard",
    missions: "/api/v1/missions",
    mission: (id: string) => `/api/v1/missions/${encodeURIComponent(id)}`,
    publishMission: (id: string) =>
      `/api/v1/missions/${encodeURIComponent(id)}/publish`,
    operators: "/api/v1/marketplace/operators",
    operator: (slug: string) =>
      `/api/v1/marketplace/operators/${encodeURIComponent(slug)}`,
    quoteComparison: (id: string) =>
      `/api/v1/missions/${encodeURIComponent(id)}/quote-comparison`,
    order: (id: string) => `/api/v1/orders/${encodeURIComponent(id)}`,
    updateOrder: (id: string) =>
      `/api/v1/enterprise/orders/${encodeURIComponent(id)}`,
    cancelOrder: (id: string) =>
      `/api/v1/enterprise/orders/${encodeURIComponent(id)}/cancel`,
    deliverables: (id: string) =>
      `/api/v1/missions/${encodeURIComponent(id)}/deliverables`,
  });
}

