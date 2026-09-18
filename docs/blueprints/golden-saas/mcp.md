# Capability: Agentic Systems, Model Context Protocol (MCP) & CLI (MCP Server, Tools, CLI, Governance, HITL)

## Purpose
Provides native AI-agent and developer integration via the Model Context Protocol (MCP) and command-line interfaces (CLI), establishing strict architectural separation between Runtime Operations and Engineering tooling.

## Functional Requirements
- **Runtime MCP Server:**
  - AI-agent integration exposing operational read tools and guarded mutation tools.
  - Multi-transport support: Standard I/O (`stdio`) for local AI clients (Claude Desktop, Cursor, Antigravity) and Streamable HTTP / SSE for remote network deployments.
  - Automatic Context & Request Tracing: `request_id`, `client_ip`, and `tenant_id` propagated through all tool executions.
  - Rate limiting & anti-burst protection on client MCP requests.
- **Engineering MCP Server:**
  - Specialized agentic tools for repository discovery, architecture mapping, gap analysis, and hotfix generation.
- **Human-In-The-Loop (HITL) Governance:**
  - High-risk mutation operations require an authorized human approval token before execution.
  - Cryptographically hashed proposal payloads (SHA-256) with TTL expiration.
- **Security & Redaction:**
  - Automated regex-based redaction of API keys, JWTs, passwords, and sensitive PII across all tool outputs.

## Domain Objects
- `McpTool`: Registered tool specification with Zod/JSON schema and risk level (`READ_ONLY`, `SAFE_WRITE`, `HIGH_RISK`).
- `ProposalRecord`: HITL pending mutation record (id, proposalHash, proposer, approver, status, expiresAt).
- `ToolExecutionAudit`: Audit record of tool call with duration, parameters, and status.

## Database Requirements
- Table `mcp_proposals` (for multi-instance persistence): `id` (string), `organization_id` (FK), `tool_name` (string), `params_hash` (string), `proposer_id` (FK), `approver_id` (FK, nullable), `status` (enum: pending, approved, rejected, executed, expired), `expires_at` (datetime), `created_at` (datetime).

## Backend Responsibilities
- MCP protocol translation to canonical Rails API operations.
- Zod schema validation on incoming tool arguments.
- Error normalization converting Rails API errors (401, 403, 404, 422) into standard MCP tool error payloads.

## Authorization Requirements
- Tenant isolation strictly enforced: MCP tool inherits the tenant identity bound to the API key or bearer token.
- High-risk tools require explicit human approval (`ProposalEngine`).

## API Requirements
- Stdio JSON-RPC 2.0 communication.
- HTTP `GET /sse` and `POST /messages` for remote MCP transport.

## ActiveAdmin Requirements
- ActiveAdmin resource `McpAudit`: Real-time stream of AI-agent tool executions with parameter inspection and error logs.

## Customer Frontend Requirements
- Settings -> AI & Integrations page: Manage MCP connection keys and review AI action history.

## Background Jobs
- `Mcp::CleanupExpiredProposalsJob`: Purges expired HITL proposals.

## Events
- `mcp.tool_called`, `mcp.mutation_executed`, `mcp.proposal_created`, `mcp.proposal_approved`.

## Webhooks
- Emits `mcp.high_risk_action` to tenant admin webhooks.

## Telemetry
- Track tool call counts, error rates, p95 execution latency, and token consumption metrics.

## Observability
- MCP server uptime, active SSE connections, memory footprint, rate limit rejections.

## Security Requirements
- 100% parameter and response redaction for sensitive fields (`token`, `password`, `key`, `secret`, `email`).
- Prohibit shell execution from MCP runtime tools.

## Failure Modes
- Upstream Rails API disconnect -> Returns normalized `UPSTREAM_UNAVAILABLE` tool error.
- Proposal expired -> Rejects mutation with `PROPOSAL_EXPIRED`.

## Required Tests
- Core unit specs: Registry, ProposalEngine, Redaction, RateLimiter, Structured Logger.
- Adapter integration specs: Tool execution against live backend with multi-tenant isolation proofs.

## Acceptance Criteria
- Zero data leakage between tenants via AI tools.
- Strict schema validation on 100% of tool invocations.

## Definition of Done
- Complete MCP server implementation (`@mcp-platform/core`, adapter packages, CLI apps) with verified unit and integration test coverage.

## LastSaaS Evidence
- `backend/cmd/lastsaas/cmd_mcp.go`: 32 read-only tools across About, Dashboard, Tenants, Users, Financial, Logs, Health, Config, Plans, Announcements, Promotions, Security, Webhooks, PM/Telemetry.
- CLI: `cmd_doctor.go`, `cmd_db.go`, `cmd_financial.go`.

## Golden Stack Adaptation
- Implement using TypeScript `@modelcontextprotocol/sdk` + `@mcp-platform/core` modular architecture interfacing Rails API.

## Optional / Product-specific Extensions
- MCP Resource templates for streaming live telemetry or drone video feeds.
