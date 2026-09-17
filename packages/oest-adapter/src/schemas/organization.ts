import { z } from "zod";
import { asId, identifierSchema, safeStringSchema } from "./common.js";

const rawOrganizationSchema = z
  .object({
    id: identifierSchema,
    name: safeStringSchema,
    organization_type: safeStringSchema.optional(),
    tenant_type: safeStringSchema,
    verification_status: safeStringSchema.optional(),
    accepting_jobs: z.boolean().optional(),
  })
  .strip();

const overviewSchema = z
  .object({
    unconfirmed: z.number().int().nonnegative().optional(),
    confirmed: z.number().int().nonnegative().optional(),
    active: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    pending_payment: z.number().int().nonnegative().optional(),
  })
  .strip();

const profileCompletionSchema = z
  .object({
    percentage: z.number().finite().min(0).max(100),
    complete: z.boolean(),
  })
  .strip();

const rawDashboardSchema = z
  .object({
    organization: rawOrganizationSchema,
    profile_completion: profileCompletionSchema,
    total_orders: z.number().int().nonnegative().optional(),
    orders_overview: overviewSchema,
    missions_overview: overviewSchema,
  })
  .strip();

export const oestDashboardResponseSchema = z
  .object({ data: rawDashboardSchema })
  .strip();

export const organizationSummaryOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  tenant_type: z.string(),
  organization_type: z.string().optional(),
  verification_status: z.string().optional(),
  accepting_jobs: z.boolean().optional(),
  profile_completion: z.object({ percentage: z.number(), complete: z.boolean() }),
  total_orders: z.number().int().optional(),
  orders: z.object({ active: z.number().int(), completed: z.number().int(), unconfirmed: z.number().int().optional(), confirmed: z.number().int().optional(), pending_payment: z.number().int().optional() }),
  missions: z.object({ active: z.number().int(), completed: z.number().int(), unconfirmed: z.number().int().optional(), confirmed: z.number().int().optional(), pending_payment: z.number().int().optional() }),
});

function safeOverview(overview: z.output<typeof overviewSchema>) {
  return {
    active: overview.active,
    completed: overview.completed,
    ...(overview.unconfirmed === undefined ? {} : { unconfirmed: overview.unconfirmed }),
    ...(overview.confirmed === undefined ? {} : { confirmed: overview.confirmed }),
    ...(overview.pending_payment === undefined
      ? {}
      : { pending_payment: overview.pending_payment }),
  };
}

export function toOrganizationSummary(
  response: z.output<typeof oestDashboardResponseSchema>,
) {
  const dashboard = response.data;
  return organizationSummaryOutputSchema.parse({
    id: asId(dashboard.organization.id),
    name: dashboard.organization.name,
    tenant_type: dashboard.organization.tenant_type,
    ...(dashboard.organization.organization_type === undefined
      ? {}
      : { organization_type: dashboard.organization.organization_type }),
    ...(dashboard.organization.verification_status === undefined
      ? {}
      : { verification_status: dashboard.organization.verification_status }),
    ...(dashboard.organization.accepting_jobs === undefined
      ? {}
      : { accepting_jobs: dashboard.organization.accepting_jobs }),
    profile_completion: dashboard.profile_completion,
    ...(dashboard.total_orders === undefined ? {} : { total_orders: dashboard.total_orders }),
    orders: safeOverview(dashboard.orders_overview),
    missions: safeOverview(dashboard.missions_overview),
  });
}
