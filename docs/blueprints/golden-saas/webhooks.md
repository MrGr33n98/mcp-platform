# Capability: Developer Platform & Integrations (API Keys & Outgoing Webhooks)

## Purpose
Enables programmatic integration for external developers, third-party agents, and automated workflows via cryptographically hashed API keys and reliable, HMAC-signed outgoing webhooks.

## Functional Requirements
- **API Keys:**
  - Prefix-formatted keys (e.g. `gsk_live_...` or `lsk_...`).
  - Raw secret displayed only once at creation time; stored exclusively as SHA-256 digests.
  - Granular scopes (e.g. `read:missions`, `write:missions`, `admin`, `readonly`).
  - Automatic `last_used_at` and `last_used_ip` tracking.
  - Instant key revocation and optional expiry date.
- **Outgoing Webhooks:**
  - Tenant-scoped webhook subscriptions with URL, description, and event type filtering.
  - HMAC-SHA256 signature header (`X-Webhook-Signature: t=...,v1=...`) computed over raw JSON payload.
  - Webhook secret encrypted at rest using AES-256-GCM.
  - Asynchronous background delivery via Sidekiq with exponential backoff (up to 5 retries).
  - Delivery history tracking with HTTP status codes, response headers, latency, and failure reasons.
  - Manual "Send Test Event" trigger.

## Domain Objects
- `ApiKey`: Tenant API key credentials with digest, scopes, and usage audit.
- `WebhookEndpoint`: Destination URL and subscribed event topics.
- `WebhookDelivery`: Dispatched event record capturing payload and overall status.
- `WebhookAttempt`: Individual HTTP attempt log (status code, duration, error message).

## Database Requirements
- Table `api_keys`: `id` (UUID), `organization_id` (FK), `user_id` (FK), `name` (string), `key_prefix` (string), `key_digest` (string, unique, indexed), `scopes` (text[], default `[]`), `expires_at` (datetime), `last_used_at` (datetime), `last_used_ip` (inet), `revoked_at` (datetime).
- Table `webhook_endpoints`: `id` (UUID), `organization_id` (FK), `url` (string), `encrypted_secret` (string), `events` (text[], default `[]`), `active` (boolean), `created_at` (datetime).
- Table `webhook_deliveries`: `id` (UUID), `webhook_endpoint_id` (FK), `event_type` (string), `payload` (jsonb), `status` (enum: pending, success, failed), `created_at` (datetime).
- Table `webhook_attempts`: `id` (UUID), `webhook_delivery_id` (FK), `response_status` (integer), `duration_ms` (integer), `error_message` (text), `created_at` (datetime).

## Backend Responsibilities
- Authentication middleware resolving API key via `Digest::SHA256.hexdigest(raw_key)` and populating `Current.organization`.
- Event publisher interceptor that dispatches Sidekiq delivery jobs when domain events occur.
- HMAC-SHA256 signature generator (`OpenSSL::HMAC.hexdigest("SHA256", secret, "#{timestamp}.#{payload}")`).
- Secret rotation service for endpoints.

## Authorization Requirements
- Only `Admin` or `Owner` roles can create, rotate, or revoke API keys and Webhook endpoints.
- API keys cannot escalate privileges beyond the permissions of their creator.
- Scopes are validated on every API request.

## API Requirements
- `GET /api/v1/developer/api_keys` (list tenant API keys - prefixes only).
- `POST /api/v1/developer/api_keys` (create key -> returns raw token ONCE).
- `DELETE /api/v1/developer/api_keys/:id` (revoke key).
- `GET /api/v1/developer/webhooks` (list webhook endpoints).
- `POST /api/v1/developer/webhooks` (create endpoint).
- `PATCH /api/v1/developer/webhooks/:id` (update subscribed events/url).
- `DELETE /api/v1/developer/webhooks/:id` (delete endpoint).
- `POST /api/v1/developer/webhooks/:id/test` (trigger test ping event).
- `GET /api/v1/developer/webhooks/:id/deliveries` (inspect delivery attempts).

## ActiveAdmin Requirements
- ActiveAdmin resource `ApiKey`: Global inspection of active keys, last used times, revocation audit (no raw keys or digests displayed).
- ActiveAdmin resource `WebhookEndpoint`: System-wide health of webhook endpoints, global failure rates, dead letter queue inspection.

## Customer Frontend Requirements
- Next.js Developer Settings dashboard:
  - API Keys tab: Create key modal with one-time copy banner, key list with scope tags and last used date.
  - Webhooks tab: Add endpoint modal with event checklist, secret reveal button, test ping button, and expandable delivery log viewer.

## Background Jobs
- `Webhooks::DeliverPayloadJob`: Performs HTTP POST with timeout (10s), records attempt, and schedules retries on 5xx / timeout.
- `ApiKeys::UpdateLastUsedJob`: Low-priority async job to batch update `last_used_at` timestamps without blocking the main request thread.

## Events
- `api_key.created`, `api_key.revoked`, `webhook.endpoint_created`, `webhook.endpoint_updated`, `webhook.delivery_succeeded`, `webhook.delivery_failed`.

## Webhooks
- Outgoing webhooks are the delivery mechanism for all subscribed domain events.

## Telemetry
- Track `api_key.authenticated`, `api_key.scope_rejected`, `webhook.dispatched`, `webhook.attempt_retry`.

## Observability
- Metrics: API key authentication volume by key prefix, webhook delivery latency p95/p99, webhook retry rates, delivery success percentage (SLO: >99.9%).

## Security Requirements
- Raw API key never saved to database, application logs, or telemetry.
- Webhook endpoints must reject private/internal IP ranges (SSRF protection: no `127.0.0.1`, `10.0.0.0/8`, `169.254.169.254`).
- Webhook payload delivery timeout strictly capped at 10 seconds.
- AES-256-GCM encryption for webhook signing secrets at rest.

## Failure Modes
- Endpoint offline -> Exponential backoff retries (1m, 5m, 30m, 2h, 8h). After 5 failures, delivery is marked `failed`.
- Repeated 410 Gone / invalid host -> Automated endpoint disabling after 100 consecutive failures with email notification to tenant admin.

## Required Tests
- Model specs: SHA-256 hashing, secret encryption, scope array validations.
- Service specs: Webhook dispatch with Faraday / WebMock, HMAC signature verification, SSRF blocker test.
- Request specs: API key authentication with valid, expired, and revoked keys; scope boundary checks.

## Acceptance Criteria
- 100% zero-plaintext storage of API keys.
- Webhook signature headers conform strictly to standard HMAC specification.
- Complete audit trail for every outgoing delivery attempt.

## Definition of Done
- Rails models, Sidekiq delivery jobs, API endpoints, ActiveAdmin management, Next.js developer dashboard, and automated test suite passed.

## LastSaaS Evidence
- `backend/internal/api/handlers/apikeys.go` (5KB), `backend/internal/api/handlers/webhooks.go` (15KB).
- `backend/internal/webhooks/dispatcher.go` (12KB), `crypto.go` (AES-256-GCM secret encryption).
- MCP tools: `list_api_keys`, `list_webhooks`, `list_webhook_event_types`, `get_webhook`.

## Golden Stack Adaptation
- Implement using Rails ActiveRecord, `ActiveRecord::Encryption` for webhook secrets, `Digest::SHA256` for API keys, Sidekiq for delivery, and SSRF prevention via `Resolv` IP address validation.

## Optional / Product-specific Extensions
- Mutual TLS (mTLS) for enterprise webhook deliveries.
- Granular IP allowlists for API keys.
