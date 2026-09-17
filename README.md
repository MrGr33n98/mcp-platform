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
```

The Rails HTTP client, shared business tools, and OEST/Avalia adapters are intentionally not implemented yet. They remain future phases and must preserve the API-first boundary described in [the architecture documentation](docs/ARCHITECTURE.md).

## Implemented packages

- `@mcp-platform/core`: reusable MCP server factory, read-only registry, typed tool contract, configuration, request context, error normalization, redaction, JSON logger, audit interface, stdio transport, and `get_platform_info`.
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

## Read-only and security policy

V1 accepts only `readOnly: true` tools and advertises `readOnlyHint: true` through the official MCP SDK. The registry, not the annotation, enforces the policy. There are no mutation, database, filesystem, shell, eval, network, Rails, Redis, or Sidekiq capabilities in this phase.

Errors use a stable envelope with a request ID and never include a stack trace. The logger, audit sink, serialized tool output, and normalized known errors centrally redact API keys, authorization headers, tokens, passwords, secrets, and cookies. Do not log `process.env` or raw HTTP payloads.

See [SECURITY.md](docs/SECURITY.md) for the full threat model and [ADR-001](docs/ADR-001-MCP-PLATFORM.md) for the architectural decision.
