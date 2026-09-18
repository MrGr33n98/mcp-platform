# Capability: Organization Memberships & Team Roles (memberships)

## Purpose
Manages user associations to organizations, assigning explicit access roles and enforcing multi-tenant team structures.

## Functional Requirements
- Link `User` and `Organization` with explicit `role` attribute (`owner`, `admin`, `member`, `viewer`).
- Users can belong to multiple organizations with distinct roles in each.
- Ability to list members, update member roles, and remove members from a team.

## Domain Objects
- `Membership`: Join table linking `User` and `Organization`.

## Database Requirements
- Table `memberships`: `id` (UUID), `organization_id` (FK), `user_id` (FK), `role` (enum: owner, admin, member, viewer), `created_at` (datetime). Unique index on `[organization_id, user_id]`.

## Backend Responsibilities
- Scoped membership queries (`current_organization.memberships`).
- Role elevation protection (members cannot elevate users above their own role).

## Authorization Requirements
- Only `owner` and `admin` can invite, change roles, or remove members.
- The last `owner` cannot be removed from an organization.

## API Requirements
- `GET /api/v1/organizations/current/members` (list members).
- `PATCH /api/v1/organizations/current/members/:id` (update role).
- `DELETE /api/v1/organizations/current/members/:id` (remove member).

## ActiveAdmin Requirements
- Resource `Membership`: Filter by organization, user, role.

## Customer Frontend Requirements
- Team members table in Organization Settings with role dropdown and "Remove" button.

## Events
- `membership.created`, `membership.updated`, `membership.deleted`.

## Webhooks
- `team.member_joined`, `team.member_removed`, `team.role_changed`.

## Telemetry
- Track `team.member_count`, `team.role_distribution`.

## Observability
- Metrics: average team size per plan tier.

## Security Requirements
- Strict Pundit `MembershipPolicy` preventing unauthorized role alterations.

## Failure Modes
- Attempting to remove the sole owner -> Returns `422 Unprocessable` with `CANNOT_REMOVE_LAST_OWNER`.

## Required Tests
- Model specs: uniqueness of user/organization pair, role enum validation.
- Policy specs: admin cannot edit owner role; viewer cannot remove anyone.

## Acceptance Criteria
- Team isolation strictly maintained across organizations.

## Definition of Done
- Rails `Membership` model, controller, Pundit policy, and Next.js team UI verified.

## LastSaaS Evidence
- `backend/internal/models/membership.go`, `backend/internal/api/handlers/tenant.go`.

## Golden Stack Adaptation
- Rails `Membership` model with ActiveRecord enum + Pundit `MembershipPolicy`.

## Optional / Product-specific Extensions
- Custom granular roles (e.g. `billing_admin`, `auditor`).
