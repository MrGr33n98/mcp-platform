# Capability: Role-Based Access Control & Pundit Policy Matrix (rbac)

## Purpose
Defines the canonical role hierarchy, permission matrix, and Pundit policy conventions governing resource access, mutation rights, and backoffice boundaries.

## Functional Requirements
- Hierarchical role model: `Owner` > `Admin` > `Member` > `Viewer`.
- Declarative Pundit policies for all domain models (Missions, Orders, Webhooks, Billing, Settings).
- Scope enforcement: queries filtered through `policy_scope` to guarantee zero cross-tenant leakage.
- Strict rejection of unauthorized actions returning `403 Forbidden` or `404 Not Found`.

## Domain Objects
- `ApplicationPolicy`: Base Pundit policy containing `user`, `record`, and `organization` contexts.

## Database Requirements
- Driven by `memberships.role` column and `users.is_super_admin` flag.

## Backend Responsibilities
- Inclusion of `Pundit::Authorization` in `ApplicationController`.
- Mandatory `verify_authorized` and `verify_policy_scoped` callbacks in non-exempt controllers.

## Authorization Requirements
| Role | View Resources | Create/Edit Resources | Manage Billing/API Keys | Transfer Ownership / Delete Org |
|---|---|---|---|---|
| **Viewer** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Member** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **Owner** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |

## API Requirements
- Standard Rails API controllers enforcing `authorize @record` on every mutation.

## ActiveAdmin Requirements
- Separate `AdminRole` authorization adapter restricting backoffice resources.

## Customer Frontend Requirements
- Role-aware UI component gating (hide or disable action buttons for Viewers/Members).

## Events
- `rbac.access_denied`.

## Telemetry
- Track `security.forbidden_access_attempts`.

## Observability
- 403 error spike monitoring.

## Security Requirements
- Fail-closed default policy: unhandled actions in Pundit return `false`.

## Failure Modes
- Missing policy method -> Raises `Pundit::NotDefinedError` in test/dev; returns `403` in production.

## Required Tests
- Policy specs for 100% of domain policies across all 4 standard roles.

## Acceptance Criteria
- 100% test coverage for Pundit policy matrix.

## Definition of Done
- Pundit policies implemented for every domain model and verified against live request specs.

## LastSaaS Evidence
- `backend/internal/api/handlers/tenant.go`, `isolation_test.go`.

## Golden Stack Adaptation
- Rails 8 `pundit` gem with strict `ApplicationPolicy` inheritance.

## Optional / Product-specific Extensions
- Fine-grained capability permissions (e.g. `can_export_reports`, `can_publish_drone_missions`).
