# Capability: Product Analytics, Telemetry & Financial Metrics (Telemetry, Funnels, SaaS KPIs, Cohorts, Engagement)

## Purpose
Provides high-fidelity product telemetry, automated event tracking, conversion funnel visualization, SaaS business KPIs, cohort retention analysis, and feature engagement metrics without impacting core application performance.

## Functional Requirements
- **Product Telemetry SDK:** In-process event dispatcher (`Telemetry.track(event, properties, user: current_user)`) with zero-overhead async batching.
- **Conversion Funnel Analytics:** End-to-end tracking of visitor journey (Unique Visitors -> Signups -> Plan Views -> Checkout Started -> Paid Subscriptions -> Plan Upgrades) with step-by-step conversion drop-off calculation.
- **SaaS Executive KPIs:** Real-time and time-series computation of MRR, ARR, ARPU, LTV (in cents), Churn Rate, Trial Conversion Rate, Median Time to First Purchase, and Active Subscriber counts.
- **Cohort Retention Analysis:** Weekly and monthly cohort retention heatmaps tracking user repeat engagement over 12+ periods.
- **Engagement Metrics:** DAU / WAU / MAU ratios for paying subscribers, average sessions per user, top features utilized, and credit consumption velocity.
- **Custom Event Explorer:** Dynamic discovery and aggregation of custom telemetry events with time-range filtering.

## Domain Objects
- `TelemetryEvent`: High-volume immutable event log record (anonymous or user-attributed).
- `DailyMetricSnapshot`: Pre-aggregated daily rollup for fast business KPI charting.
- `CohortRecord`: User cohort membership and activity retention state.

## Database Requirements
- Table `telemetry_events`: `id` (UUID), `organization_id` (FK, nullable), `user_id` (FK, nullable), `event_name` (string, indexed), `properties` (jsonb), `timestamp` (datetime, indexed), `ip_address` (inet), `user_agent` (string). Partitioned by month in PostgreSQL for efficient TTL purging (365-day retention).
- Table `daily_metric_snapshots`: `id` (UUID), `date` (date, unique, indexed), `mrr_cents` (bigint), `arr_cents` (bigint), `active_subscribers` (integer), `dau` (integer), `wau` (integer), `mau` (integer), `new_signups` (integer), `paid_conversions` (integer), `churned_subscribers` (integer).

## Backend Responsibilities
- Async telemetry ingestion pipeline using Redis buffer / Sidekiq batch workers.
- Daily aggregation worker (`Telemetry::ComputeDailyRollupJob`) calculating MRR/ARR and cohort matrices.
- Anonymization and IP hashing where privacy regulations (GDPR/LGPD) require.
- API endpoints serving structured charting data for backoffice and executive dashboards.

## Authorization Requirements
- Ingestion endpoints: Anonymous allowed for page views (strictly rate-limited); authenticated for user events.
- Metrics & KPI querying: Super Admins and authorized Executives only.

## API Requirements
- `POST /api/v1/telemetry/events` (public/authenticated event ingestion batch).
- `GET /api/admin/pm/funnel` (conversion funnel stats with time range query).
- `GET /api/admin/pm/kpis` (current snapshot and 30-day KPI trends).
- `GET /api/admin/pm/retention` (weekly/monthly cohort retention heatmap data).
- `GET /api/admin/pm/engagement` (DAU/MAU, session frequency, feature usage).
- `GET /api/admin/pm/events` (custom event trend data).

## ActiveAdmin Requirements
- Executive Metrics dashboard tab in ActiveAdmin rendering interactive charts (MRR growth, Churn, Funnel drop-offs, Cohort heatmap, Top features).

## Customer Frontend Requirements
- Lightweight client-side analytics hook (`useTelemetry()`) capturing page views and key user interactions without blocking UI render.

## Background Jobs
- `Telemetry::FlushEventBufferJob`: Flushes Redis event queues to PostgreSQL in batches every 10 seconds.
- `Telemetry::ComputeDailyRollupJob`: Nightly rollup calculation.
- `Telemetry::PurgeOldEventsJob`: Drops PostgreSQL event partitions older than 365 days.

## Events
- `telemetry.funnel_completed`, `telemetry.anomaly_detected`, `telemetry.churn_spike`.

## Webhooks
- Outgoing webhook to external analytics (Segment, PostHog, or Data Warehouse) if configured.

## Telemetry
- Self-monitoring: Ingestion latency, dropped event count, buffer queue size.

## Observability
- Ingestion throughput (events/sec), buffer lag, PostgreSQL partition size.

## Security Requirements
- Zero logging of passwords, credit cards, full names, or sensitive business payloads in `properties`.
- Rate limiting on public ingestion endpoints (e.g. 60 req/min per IP).

## Failure Modes
- Database under high load -> Events are safely buffered in Redis without crashing customer requests.
- Redis unavailable -> Fallback to synchronous database write or graceful drop with alert.

## Required Tests
- Service specs: Event batching, property sanitization, funnel calculation algorithm.
- Job specs: Daily rollup calculations (verifying MRR and churn math across edge cases).
- Request specs: Ingestion rate limits, admin authorization gates.

## Acceptance Criteria
- Telemetry ingestion adds $< 2\text{ms}$ overhead to customer API responses.
- KPI computations match Stripe financial transactions with zero discrepancy.

## Definition of Done
- Rails telemetry ingestion pipeline, daily rollup jobs, ActiveAdmin visualization, and client tracking hooks implemented with full unit/integration test coverage.

## LastSaaS Evidence
- `backend/internal/telemetry/`: `telemetry.go`.
- `backend/internal/api/handlers/telemetry.go` (6KB), `pm.go` (4KB).
- Models: `telemetry.go`, `usage_event.go`.
- MCP tools: `get_funnel`, `get_kpis`, `get_retention`, `get_engagement`, `get_custom_events`, `list_event_types`.

## Golden Stack Adaptation
- Implement using Rails + Redis buffer (`Sidekiq::Batch` / Redis list) + PostgreSQL partitioned tables, integrated optionally with PostHog, and exposed via ActiveAdmin + Chartkick / Recharts.

## Optional / Product-specific Extensions
- Export to BigQuery / Snowflake data warehouse via periodic parquet exports.
