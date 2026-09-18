# Capability: Multi-Tenancy, Memberships & RBAC (Tenancy, Memberships, Invitations, RBAC, Ownership Transfer)

## Purpose
Enforces multi-tenant data isolation, organization memberships, granular role-based access control (RBAC), team invitation workflows, and secure ownership transfer.

## Functional Requirements
- Multi-tenant architecture where every core resource is strictly owned by an `Organization` / `Tenant`.
- Role hierarchy within an organization: `Owner` > `Admin` > `Member` > `Viewer`.
- Cross-tenant strict isolation: Tenant A cannot read, update, delete, or enumerate Tenant B's data (`404 Not Found` response).
- Email-based team invitations with token expiration (7 days) and role assignment.
- Secure Organization ownership transfer requiring explicit confirmation from both current and prospective owner.
- Tenant configuration and profile settings (name, slug, logo, timezone).

## Domain Objects
- `Organization` / `Tenant`: Primary tenant boundary.
- `Membership`: Join table linking `User` and `Organization` with `role`.
- `Invitation`: Pending team invitation with token, recipient email, target organization, and assigned role.
- `TenantSetting`: Key-value or JSON settings for the organization.

## Database Requirements
- Table `organizations`: `id` (UUID), `name` (string), `slug` (string, unique, indexed), `status` (enum: active, suspended), `owner_id` (FK to users).
- Table `memberships`: `id` (UUID), `organization_id` (FK, indexed), `user_id` (FK, indexed), `role` (enum: owner, admin, member, viewer), `created_at` (datetime). Unique index on `[organization_id, user_id]`.
- Table `invitations`: `id` (UUID), `organization_id` (FK), `inviter_id` (FK), `email` (citext), `role` (string), `token_digest` (string, unique), `expires_at` (datetime), `accepted_at` (datetime).

## Backend Responsibilities
- Organization resolution middleware / controller concerns (`Current.organization`, `SetTenant`).
- Default ActiveRecord scoping via tenant association (`organization.missions`, `organization.orders`).
- Pundit policies enforcing role capabilities per tenant context (`OrganizationPolicy`, `MembershipPolicy`, `InvitationPolicy`).
- Atomic transactions for ownership transfer.

## Authorization Requirements
- Only `Owner` or `Admin` can invite members or update tenant settings.
- Only `Owner` can transfer ownership or delete the organization.
- Members cannot modify permissions of users with equal or higher roles.
- Cross-tenant requests must return `404 Not Found` to prevent resource enumeration.

## API Requirements
- `GET /api/v1/organizations/current` (get current active organization details).
- `PATCH /api/v1/organizations/current` (update tenant profile/settings).
- `GET /api/v1/organizations/current/members` (list members with roles).
- `DELETE /api/v1/organizations/current/members/:id` (remove member).
- `POST /api/v1/organizations/current/invitations` (invite team member).
- `POST /api/v1/organizations/current/transfer_ownership` (initiate ownership transfer).

## ActiveAdmin Requirements
- ActiveAdmin resource `Organization`: View member counts, subscription status, audit activity, suspend/reactivate tenant.
- ActiveAdmin resource `Membership`: Inspect roles across organizations with filtering.

## Customer Frontend Requirements
- Next.js organization switcher in navigation.
- Team settings page: Member list table, role selector dropdown, invitation modal, and ownership transfer dialog with double confirmation.

## Background Jobs
- `Tenancy::SendInvitationEmailJob`: Dispatches invitation email with secure accept link.
- `Tenancy::PurgeExpiredInvitationsJob`: Cleanup of unclaimed invitations.

## Events
- `tenant.created`, `tenant.updated`, `tenant.suspended`, `membership.created`, `membership.role_changed`, `membership.deleted`, `invitation.sent`, `invitation.accepted`, `ownership.transferred`.

## Webhooks
- Emits `team.member_joined`, `team.member_removed`, `team.role_updated` to tenant endpoints.

## Telemetry
- Track `team.member_invited`, `team.invitation_accepted`, `organization.created`.

## Observability
- Metrics on active tenants, distribution of organization sizes (seat count), invitation conversion rate.

## Security Requirements
- All queries must be scoped to `Current.organization`. Never permit arbitrary `organization_id` parameters from client payloads.
- Rate limiting on invitation dispatch to prevent email spam.

## Failure Modes
- Database connection tenant leak -> Mitigated by request-lifecycle scoping in `Current.organization` and reset in around_action.
- Owner leaves organization -> Organization deletion or automated promotion policy.

## Required Tests
- Model specs: uniqueness of membership pairs, role enum validations.
- Policy specs: comprehensive role matrix across all actions.
- Cross-tenant isolation request specs: Tenant A token querying Tenant B resources returns 404.

## Acceptance Criteria
- Complete isolation between tenants across 100% of API endpoints.
- Role boundaries enforced on both API and UI layers.

## Definition of Done
- Multi-tenancy models, Pundit policies, controllers, ActiveAdmin interfaces, and Next.js team management components fully implemented and covered by unit/integration tests.

## LastSaaS Evidence
- `backend/internal/models/tenant.go`, `membership.go`, `invitation.go`.
- `backend/internal/api/handlers/tenant.go`: 19KB containing membership management, invitations, ownership transfer, isolation tests (`isolation_test.go`).
- `backend/cmd/lastsaas/cmd_tenants.go`: CLI inspection of tenants and members.

## Golden Stack Adaptation
- Implement using Rails ActiveRecord associations, `acts_as_tenant` or explicit `Current.organization` scoping, Pundit RBAC policies, and Next.js App Router layout tenant providers.

## Optional / Product-specific Extensions
- Multi-organization support per user with dynamic context switching.
- Custom granular permission matrices for enterprise tiers.
