# Capability: Operations, Admin Backoffice & Audit Trails (Admin, Audit, Activity Log, Announcements, Impersonation, Config)

## Purpose
Provides backoffice control, operational observability, security audit logging, system-wide configuration management, announcements, and controlled support impersonation.

## Functional Requirements
- **Admin Backoffice:** Unified internal control plane (ActiveAdmin) for managing users, organizations, subscriptions, billing overrides, system health, and queues.
- **Audit Trails:** Immutable, append-only security log recording actor, action, target resource, IP address, user-agent, and sanitized payload changes across all mutation channels (Web, API, MCP, Worker, System).
- **Tenant Activity Logs:** Customer-facing activity logs displaying team actions within their organization.
- **System Announcements:** In-app banner and modal broadcasting for maintenance windows, product updates, and critical alerts.
- **Controlled Impersonation:** Time-limited (e.g. 15-minute) admin impersonation with mandatory audit logging and reason prompt.
- **Dynamic Configuration:** Runtime-editable configuration variables (log levels, rate limits, feature gates) stored with type validation.

## Domain Objects
- `AuditEvent`: Append-only system audit record.
- `TenantActivity`: Tenant-scoped activity log record.
- `Announcement`: Broadcast notification entity.
- `ConfigVar`: Dynamic configuration key-value pair with schema type validation.
- `ImpersonationSession`: Temporary token authorizing support access.

## Database Requirements
- Table `audit_events`: `id` (UUID), `organization_id` (FK, nullable for system actions), `actor_id` (FK to users, nullable for system), `actor_type` (enum: user, api_key, mcp, system), `action` (string), `resource_type` (string), `resource_id` (string), `request_id` (string), `ip_address` (inet), `user_agent` (string), `metadata` (jsonb), `created_at` (datetime). Indexed on `[organization_id, created_at]`, `[actor_id, created_at]`.
- Table `tenant_activities`: `id` (UUID), `organization_id` (FK), `user_id` (FK), `action` (string), `description` (string), `metadata` (jsonb), `created_at` (datetime).
- Table `announcements`: `id` (UUID), `title` (string), `body` (text), `severity` (enum: info, warning, critical), `published_at` (datetime), `expires_at` (datetime), `target_plans` (text[]).
- Table `config_vars`: `id` (UUID), `key` (string, unique, indexed), `value_type` (enum: string, integer, boolean, enum, json), `value` (text), `description` (text), `updated_by_id` (FK to users).

## Backend Responsibilities
- `Audit::RecordEvent` service called across all controller mutations, MCP operations, and background jobs.
- Automatic PII and credential redaction on all audit metadata payloads before database write.
- Read-only ActiveAdmin adapters for audit queries with CSV export capabilities.
- Impersonation token issue and validation concern.

## Authorization Requirements
- Audit events are strictly append-only; `DELETE` and `UPDATE` operations are blocked by database triggers and ActiveRecord callbacks.
- Only users with `super_admin` or `support_admin` roles can access the ActiveAdmin portal.
- Tenant members can only view their own `tenant_activities`.

## API Requirements
- `GET /api/v1/organizations/current/activity` (customer tenant activity feed).
- `GET /api/v1/announcements/active` (active announcements for the current user/tenant).
- ActiveAdmin internal endpoints for backoffice operations.

## ActiveAdmin Requirements
- Comprehensive ActiveAdmin dashboard:
  - Users, Organizations, Memberships, Subscriptions, Invoices.
  - Audit Trail explorer with advanced filtering (by actor, action, resource, date range, IP).
  - Config Variables manager with in-place validation.
  - Announcements manager with live markdown preview.
  - Sidekiq Web UI mounted behind ActiveAdmin authentication.

## Customer Frontend Requirements
- In-app notification bar / banner displaying active announcements.
- Team settings "Audit & Activity" page showing chronological actions (who joined, what settings changed, billing updates).

## Background Jobs
- `Audit::ArchiveAuditLogsJob`: Archives audit entries older than 365 days to cold S3 storage.
- `Announcements::BroadcastNotificationJob`: Pushes high-priority announcement webhooks/emails.

## Events
- `audit.event_logged`, `announcement.published`, `config.updated`, `impersonation.started`, `impersonation.ended`.

## Webhooks
- Emits `audit.security_alert` on suspicious activity or critical policy violations.

## Telemetry
- Track `admin.login`, `admin.impersonation_started`, `config.changed`.

## Observability
- Metrics on audit event ingestion throughput, volume by actor type, admin action latency.

## Security Requirements
- Database-level constraint or trigger preventing `UPDATE` / `DELETE` on `audit_events`.
- Strict redaction of passwords, credit cards, JWTs, and API keys before persisting metadata.
- Impersonation sessions cannot perform destructive actions (e.g. account deletion, ownership transfer).

## Failure Modes
- Audit database write failure -> Must raise exception on critical security mutations (fail-closed for security operations) or fall back to local syslog.

## Required Tests
- Model specs: immutability of audit records, config variable type coercion.
- Request specs: customer activity isolation between tenants.
- Security specs: verify sensitive fields (`password`, `token`, `secret`) are sanitized out of `audit_events.metadata`.

## Acceptance Criteria
- 100% of sensitive mutations generate an audit trail entry.
- Audit records are tamper-resistant and cannot be modified by any user.

## Definition of Done
- Database tables, ActiveRecord models, ActiveAdmin resources, customer activity UI, and automated security test suite passed.

## LastSaaS Evidence
- `backend/internal/api/handlers/admin.go` (58KB), `announcements.go` (5KB), `config.go` (6KB), `logs.go` (6KB).
- `backend/cmd/lastsaas/cmd_logs.go`, `cmd_users.go`, `cmd_tenants.go`.
- MCP tools: `search_logs`, `get_log_severity_counts`, `list_config`, `get_config`, `list_announcements`.

## Golden Stack Adaptation
- Implement using Rails ActiveAdmin (`activeadmin` gem) + Pundit authorization, PostgreSQL append-only tables, and Next.js frontend components for announcement banners and activity feeds.

## Optional / Product-specific Extensions
- SIEM integration (streaming audit logs directly to AWS CloudWatch, Datadog, or Splunk).
