# OEST MCP Local Integration Report

Date: 2026-09-17  
Status: partial local integration validation; valid development API-key scenarios are blocked by unavailable local credentials.

## Environment

- MCP workspace: `C:\Users\Bobi\Desktop\mcp-platform`
- OEST workspace: `C:\Users\Bobi\Desktop\drone\dronehub` (read-only)
- Rails base URL: `http://localhost:3001`
- Rails environment: `development`
- Official local start command used: `bundle exec rails server -p 3001`
- Rails version reported during boot: 8.0.5
- `GET /health`: HTTP 200, with `status`, `service`, `time`, and `version`.

The Rails process was started only for this test and stopped afterwards. No migration, seed, model, console, direct database, Redis, or Sidekiq access was used. `rails-ai-context` was not connected and its CLI was unavailable in this execution environment.

## Direct Rails API Results

| Endpoint | Credential | HTTP | Observed result |
|---|---|---:|---|
| `/health` | none | 200 | `{ status, service, time, version }` |
| `/api/v1/billing/plan` | none / invalid | 401 | `UNAUTHENTICATED` problem envelope |
| `/api/v1/billing/usage` | none | 401 | `UNAUTHENTICATED` problem envelope |
| `/api/v1/enterprise/api_keys` | none | 401 | `UNAUTHENTICATED` problem envelope |
| `/api/v1/enterprise/dashboard` | none | 401 | `UNAUTHENTICATED` problem envelope |
| `/api/v1/missions` | none / invalid | 401 | `UNAUTHENTICATED` problem envelope |
| `/api/v1/marketplace/operators` | none | 200 | `{ data: [], meta: { request_id } }` |

Protected actions halted at the Rails `authenticate_user!` filter. The public marketplace endpoint correctly returned a valid empty envelope and a request ID. No headers or credentials are recorded in this document.

## Authentication and Tenancy

- No credential: verified 401 for protected endpoints.
- Deliberately invalid credential: verified 401 for protected endpoints.
- Valid local development API key: **not testable**. No key was present in the session and no key was generated, read from the database, or written to a file.
- Scope-denial (403): **not testable** without a safely provided key with known scopes.
- API-key resolution of user, organization, scopes, `current_organization`, TenantScope, and Pundit: **not testable** without a valid local API key.
- Cross-tenant read denial: **not testable**. The local dataset exposed no authorized tenant/key pair and no known second-tenant resource. No tenants, missions, orders, or API keys were created for this task.

## MCP stdio Results

The OEST MCP app was started over stdio with a deliberately invalid session-only value solely to exercise unauthenticated behavior. Startup made no Rails request. No value was written to an environment file.

`tools/list` registered exactly:

- `get_platform_info`
- `get_system_health`
- `get_subscription_summary`
- `get_usage_summary`
- `get_api_key_usage`
- `get_organization_summary`
- `list_missions`
- `get_mission`
- `get_mission_summary`
- `list_operators`
- `get_operator_summary`
- `get_quote_summary`
- `get_order_summary`
- `get_deliverable_summary`

It did not register `get_integration_health`, `get_failed_webhooks`, or `get_failed_jobs`. Every registered tool advertised `readOnlyHint: true`; no mutation tool was present.

| Tool | Rails endpoint | HTTP | Schema/result |
|---|---|---:|---|
| `get_platform_info` | none | n/a | Safe local platform metadata returned. |
| `get_system_health` | `/health` | 200 | Zod validation passed; output reports only `oest_api` health and timestamp. |
| `list_operators` | `/api/v1/marketplace/operators?limit=1` | 200 | Zod validation passed; valid empty `{ items: [], limit: 1 }`. |
| `get_subscription_summary` | `/api/v1/billing/plan` | 401 | Normalized MCP error `RAILS_API_UNAUTHORIZED`, with request ID and no credential. |
| Valid-key domain and shared tools | protected endpoints | not run | Blocked pending a development API key. |

## Pagination, Empty States, and Errors

- `list_missions({ limit: 101 })` was rejected by MCP input validation before a Rails request.
- `list_missions({ limit: 1, offset: -1 })` was rejected by MCP input validation before a Rails request.
- Marketplace operators returned the valid empty state described above.
- Real 401 handling was validated directly and through MCP.
- Real 403 and 404 require a valid key and safely identifiable authorized/unauthorized fixtures; they were not fabricated.
- 429 and 5xx remain covered by the existing local mock regression suite; no rate-limit or service failure was induced against Rails.

## Security Review

- No Authorization value, API key, cookie, JWT, digest, storage key, presigned URL, password, or environment dump appeared in the MCP output captured for this test.
- MCP structured logs contained tool name, request ID, status, and duration only; the Rails-client path was redacted.
- No MCP request accepted a model-controlled endpoint, method, organization, or tenant override.
- The adapter retained GET-only behavior and did not access PostgreSQL, Redis, Sidekiq, the filesystem, shell, or Rails internals.

## Schema Changes

None. The real health response and public empty marketplace response matched the existing Zod contracts. Protected response contracts cannot be validated until a local development API key is supplied.

## Gaps Before Phase 5D

Provide a session-only local development API key and, if available, two pre-existing test tenants with known mission/order IDs. Then rerun the protected tool matrix, API-scope 403 case, current-organization resolution, TenantScope/Pundit checks, cross-tenant denial, and real non-empty mission/quote/order/deliverable contract checks.
