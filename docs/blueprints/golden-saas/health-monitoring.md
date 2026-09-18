# Capability: Health Monitoring, Observability & Infrastructure (Health Monitoring, Node Health, System Vitals, Integrations, Alerts)

## Purpose
Provides continuous health monitoring across all platform nodes, active dependency probing (PostgreSQL, Redis, Sidekiq, Storage, Stripe, Email), HTTP request performance metrics, system vitals (CPU, Memory, Disk), and automated threshold alerting.

## Functional Requirements
- **Multi-Level Health Endpoints:**
  - Liveness (`/up`, `/health/live`): Fast check verifying web server process is responsive.
  - Readiness (`/health/ready`): Probes critical local dependencies before routing traffic.
  - Deep Health (`/api/admin/health/current`): Comprehensive diagnostic report across all subsystem components.
- **Automated Node Registration & Heartbeats:**
  - Background worker on each application node reporting hostname, version, git commit SHA, and resource utilization every 30 seconds.
- **Dependency & Integration Probing:**
  - Active latency and status checks for PostgreSQL (read/write), Redis (PING/PONG), Sidekiq (queue latency & dead jobs), ActiveStorage (S3/Spaces connectivity), Stripe API, and Resend/SMTP email delivery.
- **Threshold-Based Alerting:**
  - Configurable alerts for high memory (>85%), high CPU (>90%), disk exhaustion (>90%), Sidekiq queue lag (>60s), and elevated 5xx error rates (>1%).

## Domain Objects
- `NodeVitals`: Transient and historical snapshot of host machine health.
- `IntegrationStatus`: Diagnostic probe result for a third-party or infrastructure dependency.
- `HealthAlert`: Active or resolved system incident alert.

## Database Requirements
- Table `node_registrations`: `id` (UUID), `hostname` (string, unique, indexed), `ip_address` (inet), `app_version` (string), `commit_sha` (string), `last_seen_at` (datetime), `status` (enum: healthy, stale, dead).
- Table `health_metric_snapshots`: `id` (UUID), `node_id` (FK), `cpu_percent` (float), `memory_used_bytes` (bigint), `memory_total_bytes` (bigint), `disk_used_bytes` (bigint), `disk_total_bytes` (bigint), `postgres_latency_ms` (integer), `redis_latency_ms` (integer), `created_at` (datetime). Indexed on `[node_id, created_at]`.

## Backend Responsibilities
- Diagnostic probes implemented via clean health checkers (`Health::PostgresChecker`, `Health::RedisChecker`, `Health::SidekiqChecker`, `Health::StorageChecker`).
- Periodic heartbeat daemon in background thread or Sidekiq cron.
- Safe timeouts (max 3s) on all dependency probes to prevent health checks from hanging.

## Authorization Requirements
- Liveness (`/up`, `/health/live`) is public for load balancers.
- Deep health and node vitals are restricted to Super Admins and MCP tooling.

## API Requirements
- `GET /up` (HTTP 200 OK or 503 Service Unavailable).
- `GET /api/admin/health/current` (real-time detailed JSON diagnostic report).
- `GET /api/admin/health/nodes` (list registered nodes and status).
- `GET /api/admin/health/integrations` (third-party status, response times, 24h error counts).
- `POST /api/admin/health/test_email` (trigger live email delivery check).

## ActiveAdmin Requirements
- System Health dashboard panel in ActiveAdmin:
  - Traffic light indicators (Green/Yellow/Red) for PostgreSQL, Redis, Sidekiq, Storage, Stripe.
  - Active nodes table with live resource meters and stale node alerts.
  - Quick action buttons: "Run Health Probes", "Send Test Email", "Clear Stale Nodes".

## Customer Frontend Requirements
- Public Status Page (optional) showing overall uptime and ongoing maintenance notices.

## Background Jobs
- `Health::NodeHeartbeatJob`: Dispatches heartbeat update every 30 seconds.
- `Health::SweepStaleNodesJob`: Marks nodes unseen for $>90$ seconds as stale/offline.
- `Health::ProactiveAlertingJob`: Evaluates threshold metrics and triggers alert notifications.

## Events
- `health.node_registered`, `health.node_stale`, `health.dependency_degraded`, `health.alert_triggered`.

## Webhooks
- Outgoing webhook to PagerDuty / Slack / Discord on critical health alerts.

## Telemetry
- Track `system.cpu_percent`, `system.memory_percent`, `system.sidekiq_queue_latency`.

## Observability
- Prometheus / OpenTelemetry export compatibility for all health metrics.

## Security Requirements
- Detailed health diagnostic endpoints must never disclose raw database credentials, S3 secret keys, or internal network topology in error traces.

## Failure Modes
- Database down -> Liveness returns 200 (process alive), Readiness returns 503, Health endpoint returns detailed degradation payload.
- Third-party API timeout -> Health probe times out after 3 seconds without blocking the rest of the report.

## Required Tests
- Unit specs for each dependency checker with mocked network failures and timeouts.
- Request specs verifying HTTP status code mappings (200 vs 503) and admin auth gates.

## Acceptance Criteria
- `/up` responds in $< 5\text{ms}$.
- Deep health check executes all probes in parallel within $< 1.5\text{s}$.

## Definition of Done
- Health checkers, node heartbeat service, ActiveAdmin health monitor, and automated test suite fully implemented and passing.

## LastSaaS Evidence
- `backend/internal/health/`: `health.go`.
- `backend/internal/api/handlers/health.go` (5KB).
- `backend/cmd/lastsaas/cmd_health.go`, `cmd_doctor.go`.
- MCP tools: `get_system_health`, `get_health_metrics`, `list_nodes`, `get_integrations`.

## Golden Stack Adaptation
- Implement using Rails 8 `up` endpoint + custom `Health::Suite` probing PostgreSQL, Redis, Sidekiq (`Sidekiq::Queue.new.latency`), ActiveStorage, and Stripe, rendered via ActiveAdmin.

## Optional / Product-specific Extensions
- Integration with Kubernetes readiness/liveness probes.
