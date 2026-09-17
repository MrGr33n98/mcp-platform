# MCP Platform

Reusable and strictly read-only Model Context Protocol platform for product-specific MCP apps. The core is independent from Rails applications and does not access databases, queues, shells, filesystem resources, or product internals.

## Current architecture

```text
AI client
  │ MCP JSON-RPC / stdio
  ▼
MCP app
  ▼
@mcp-platform/core
  ├─ ToolRegistry + Zod validation
  ├─ context + request IDs
  ├─ logging + secret redaction
  ├─ audit sink
  └─ MCP server factory + stdio transport
  ▼
@mcp-platform/rails-api-client
  └─ fixed-origin GET requests only
  ▼
Rails API
```

The OEST/Avalia adapters are intentionally not implemented yet. They remain future phases and must preserve the API-first boundary described in [the architecture documentation](docs/ARCHITECTURE.md).

## Implemented packages

- `@mcp-platform/core`: reusable MCP server factory, read-only registry, typed tool contract, configuration, request context, error normalization, redaction, JSON logger, audit interface, stdio transport, and `get_platform_info`.
- `@mcp-platform/rails-api-client`: generic Rails API client. It permits only fixed-origin relative `/api/...` GET requests, adds MCP headers, bounds response size, validates optional Zod response schemas, and uses the core error/redaction contracts.
- `@mcp-platform/shared-tools`: reusable read-only health, integration, subscription, usage, webhook, and API-key metadata tools. It receives capabilities and endpoint paths from a future product adapter; it contains no OEST or Avalia endpoint.
- `@mcp-platform/platform-smoke`: a minimal local app that registers only `get_platform_info`; it does not call Rails or any network service.

## Install and validate

Node.js 20 or newer is required.

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Run the smoke MCP server

```bash
npm run dev:smoke
# or, after building
npm run start:smoke
```

The smoke app uses `stdio`. Its protocol uses stdout; structured logs and audit events go to stderr. It defaults to the safe local product identity `platform-smoke`; a real app must set `MCP_PRODUCT_ID` and `MCP_PRODUCT_NAME` explicitly.

Supported configuration:

| Variable | Required | Default |
|---|---:|---|
| `MCP_PRODUCT_ID` | yes in `loadConfig` | none |
| `MCP_PRODUCT_NAME` | yes in `loadConfig` | none |
| `MCP_LOG_LEVEL` | no | `info` |
| `MCP_VERSION` | no | `0.1.0` |

## Register a new read-only tool

Tools are defined with a strict Zod schema and registered in a product app or future adapter. The registry rejects duplicate names, invalid names, missing schema/description, and every `readOnly: false` definition.

```ts
import { z } from "zod";
import type { ToolDefinition } from "@mcp-platform/core";

const getExampleInput = z.object({ id: z.string().min(1) }).strict();

const getExample: ToolDefinition<typeof getExampleInput> = {
  name: "get_example",
  description: "Return a safe example read model.",
  readOnly: true,
  inputSchema: getExampleInput,
  async execute(_context, input) {
    return { id: input.id, status: "available" };
  },
};
```

Future product tools must call only fixed, authorized Rails API read models. They must not accept URLs, SQL, shell commands, file paths, headers, credentials, or arbitrary executable input.

## Rails API client (GET-only V1)

`@mcp-platform/rails-api-client` is the only future path from a product adapter to a Rails application. It has no database, Redis, Sidekiq, Rails-model, filesystem, shell, or mutation capability. It exposes `get` only; there is no public generic request method and no `post`, `put`, `patch`, or `delete` method.

```ts
import { RailsApiClient } from "@mcp-platform/rails-api-client";
import { z } from "zod";

const client = new RailsApiClient({
  baseUrl: process.env.RAILS_API_BASE_URL ?? "",
  apiKey: process.env.RAILS_API_KEY ?? "",
  productId: "oest",
  clientName: "oest-mcp",
});

const companySchema = z.object({ id: z.string(), name: z.string() }).strict();
const company = await client.get({
  path: "/api/v1/companies/company-123",
  requestId: "per-call-request-id",
  responseSchema: companySchema,
});
```

The client validates `baseUrl` as HTTP(S), rejects credentials, query strings, and fragments in that configuration, and then accepts only `/api/...` paths resolved against the configured origin. Protocol overrides, `//host`, backslashes, inline query strings, fragments, and non-API paths are blocked. Query data must be a flat object of strings, numbers, booleans, or `undefined`; it is encoded with `URLSearchParams`.

Every GET includes `Authorization: Bearer <apiKey>`, `Accept: application/json`, `X-Request-ID`, `X-MCP-Client`, and `X-Product-ID`. The client never logs request or response bodies, authorization values, cookies, raw headers, or full URLs. It emits only redacted structured metadata through an optional core logger: request ID, method, relative path, status, duration, and attempt.

| Configuration | Required | Default |
|---|---:|---|
| `baseUrl` | yes | none |
| `apiKey` | yes | none |
| `productId` | yes | none |
| `clientName` | yes | none |
| `timeoutMs` | no | `10000` |
| `maxRetries` | no | `2` (maximum `2`) |
| `maxResponseBytes` | no | `2097152` (2 MiB) |

Responses must be JSON except for `204 No Content`. Malformed JSON, unexpected content types, bodies exceeding the size limit, and Zod schema failures are rejected without returning the upstream payload. The public MCP response continues to use the core error envelope and the original request ID.

Retries are limited to two additional attempts with bounded exponential backoff, and only occur for `429`, `502`, `503`, `504`, timeouts, or transient network failures. The client does not retry `400`, `401`, `403`, `404`, or `422`; it does not follow redirects. HTTP failures are mapped to stable `RAILS_API_*` codes such as `RAILS_API_TIMEOUT`, `RAILS_API_UNAUTHORIZED`, `RAILS_API_NOT_FOUND`, `RAILS_API_RATE_LIMITED`, and `RAILS_API_UPSTREAM_ERROR`.

## Shared tools (read-only V1)

`@mcp-platform/shared-tools` provides factories for capabilities shared across SaaS products:

- `get_system_health`
- `get_integration_health`
- `get_subscription_summary`
- `get_usage_summary`
- `get_failed_webhooks`
- `get_api_key_usage`

The package does not define a Rails endpoint contract for any product. A product adapter owns the trusted `SharedEndpointMap`, creates `SharedCapabilities`, and decides which tools to register. The MCP model never supplies an endpoint, method, header, or base URL.

```ts
import {
  createSharedCapabilities,
  createSystemHealthTool,
} from "@mcp-platform/shared-tools";

const capabilities = createSharedCapabilities(adapterOwnedEndpointMap);

if (capabilities.hasCapability("system_health")) {
  registry.register(createSystemHealthTool({ client: railsClient, capabilities }));
}
```

`SharedEndpointMap` has optional mappings for `systemHealth`, `integrationHealth`, `subscriptionSummary`, `usageSummary`, `failedWebhooks`, and `apiKeyUsage`. Its values must be safe relative API paths. If a factory is invoked without its capability, execution fails closed with `CAPABILITY_NOT_AVAILABLE`; it never guesses an endpoint.

All inputs are strict Zod schemas. Usage periods are a fixed enum and webhook pagination defaults to `page=1`, `per_page=25`, with `per_page` capped at `100`. All Rails responses are validated with strict Zod schemas before returning. API-key and webhook payloads reject raw key material, signature secrets, bodies, headers, and unrecognized fields; health diagnostics reject URLs, hostnames, credentials, stack/environment references, and secret markers.

## Read-only and security policy

V1 accepts only `readOnly: true` tools and advertises `readOnlyHint: true` through the official MCP SDK. The registry, not the annotation, enforces the policy. The generic Rails client permits only read-only GET calls to its configured Rails API origin. There are no mutation, database, filesystem, shell, eval, Redis, or Sidekiq capabilities in this platform.

Errors use a stable envelope with a request ID and never include a stack trace. The logger, audit sink, serialized tool output, and normalized known errors centrally redact API keys, authorization headers, tokens, passwords, secrets, and cookies. Do not log `process.env` or raw HTTP payloads.

See [SECURITY.md](docs/SECURITY.md) for the full threat model and [ADR-001](docs/ADR-001-MCP-PLATFORM.md) for the architectural decision.
