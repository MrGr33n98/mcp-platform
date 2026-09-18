# Roadmap da MCP Platform

## V0 — Architecture (Concluída em 2026-09-17)

- [x] Auditar workspace e corrigir `.gitignore`.
- [x] Estudar LastSaaS como referência arquitetural, não dependência de código.
- [x] Definir limites API-first, contratos, adapters, tool taxonomy e threat model.
- [x] Criar os documentos de arquitetura e o ADR.

---

## V1 — Core + stdio + HTTP client + tools read-only

### Phase 2 — MCP Core (Concluída em 2026-09-17)
- [x] Converter o repositório para npm workspaces com `@mcp-platform/core` e `@mcp-platform/platform-smoke`.
- [x] Implementar core: registry com classificação de risco, context/request IDs, config Zod, erros, redaction, logger, audit, factory MCP e `stdio`.
- [x] Integrar o SDK oficial `@modelcontextprotocol/sdk` e registrar `get_platform_info`.
- [x] Cobrir registry, contexto, erros, redaction, config, plataforma e auditoria com testes locais.

### Phase 3 — Rails API Client (Concluída em 2026-09-17)
- [x] Implementar `RailsApiClient` com origem configurada, Bearer, timeout/abort, retry limitado, resposta JSON limitada e redaction.
- [x] Suporte a verbos HTTP de mutação (`POST`, `PATCH`, `PUT`, `DELETE`), headers `Idempotency-Key` e rate limiting local anti-burst.
- [x] Mapeamento de status `409 Conflict`, `422 Unprocessable` e `429 Rate Limited`.

### Phase 4 — Shared Read-only Tools (Concluída em 2026-09-17)
- [x] Criar `@mcp-platform/shared-tools` com capabilities e `SharedEndpointMap` configurados pelo adapter.
- [x] Implementar factories read-only para system health, subscription summary, usage summary e API key usage.
- [x] Validar inputs, paginação e sanitização de diagnósticos/segredos com Zod estrito.

---

## V1.1 — Integração OEST / DroneHub em Produção

### Phase 5B — Adapter & App OEST (Concluída em 2026-09-17)
- [x] Implementar `@mcp-platform/oest-adapter` e `@mcp-platform/oest-mcp`.
- [x] Integrar organização, missões, operadores, ordens e capabilities compartilhadas.

### Phase 5C & 5C.1 — Auth & Multi-Tenant Integration Gate (Concluída em 2026-09-17)
- [x] Executar testes de integração live contra Rails 8.0.5 real com chaves DEV autorizadas.
- [x] Comprovar isolamento multi-tenant estrito (404 em cross-tenant) e zero vazamento de segredos.

### Phase 5D — Operational Tools + Mutation Safety (Concluída em 2026-09-17)
- [x] Implementar ferramentas de mutação operacional: `create_mission`, `publish_mission`, `update_order`, `cancel_order`.
- [x] Garantir classificação explícita de risco (`write`, `sensitive`), idempotência e integridade multi-tenant.

### Phase 5E — Rollout Operacional, Observabilidade & CLI (Concluída em 2026-09-17)
- [x] Implementar `MetricsCollector` para latência P50/P95, contagem de chamadas e taxas de erro (SLOs).
- [x] Implementar `TokenBucketRateLimiter` para proteção contra rajadas de IA.
- [x] Configurar binário executável CLI `npx @mcp-platform/oest-mcp` (`bin/oest-mcp.js`) com flags `--help` e `--version`.
- [x] Documentar procedimento operacional de rotação de chaves zero-downtime em `docs/KEY_ROTATION_PROCEDURE.md`.

---

## V1.2 — Integração Avalia Solar (Concluída em 2026-09-17)

- [x] Implementar `@mcp-platform/avalia-adapter` e `apps/avalia-mcp`.
- [x] Implementar ferramentas do Avalia Solar: `get_company_summary`, `get_review_summary`, `get_lead_summary` (com minimização de PII), `get_sales_pipeline` e `get_material_download_summary`.
- [x] Suíte de testes unitários com Zod estrito e isolamento multi-company.

---

## V2 — Transporte Streamable HTTP / Cloud Remote MCP (Concluída em 2026-09-17)

- [x] Implementar `createHttpServer` em `@mcp-platform/core` com suporte a Server-Sent Events (`GET /sse`) e POST JSON-RPC (`POST /messages`).
- [x] Autenticação de transporte via Bearer token (`authToken`), validação de `Origin` e cabeçalhos CORS configuráveis.
- [x] Endpoints nativos `/health` e `/metrics`.

---

## V3 & V4 — Governança Avançada Dry-Run e Human-in-the-Loop (HITL) (Concluída em 2026-09-17)

- [x] Suporte a simulação `dry_run: true` em ferramentas operacionais de mutação, permitindo preview de impacto antes do commit.
- [x] Motor de propostas de ação (`ProposalEngine`) com hashing SHA-256 anti-adulteração e expiração automática por TTL.
- [x] Fila de propostas para revisão e aprovação humana explícita (`propose`, `approve`, `reject`, `listPending`).
- [x] Guia de governança documentado em `docs/HITL_GOVERNANCE_GUIDE.md`.

---

## V5 — Golden SaaS Engineering Platform (Em Andamento)

### Phase 0 — Final Runtime Release Gate (Concluída em 2026-09-17)
- [x] Auditoria de 157 testes PASS, Typecheck e Build.
- [x] Classificação de Transporte (`CUSTOM_STREAMABLE_SSE`), Dry-run (`DRY_RUN_LOCAL_ONLY`), HITL (`DEV_LOCAL_ONLY`).
- [x] Relatório formal em `docs/FINAL_RUNTIME_MCP_RELEASE_AUDIT.md`.

### Phase 5A — Golden SaaS Blueprint (Concluída em 2026-09-17)
- [x] Estudo minucioso do repositório `jonradoff/lastsaas` via GitHub MCP (models, auth, billing, webhooks, admin, telemetry, CLI, MCP).
- [x] Documentação em Markdown (`docs/blueprints/golden-saas/`) com 20 seções obrigatórias por capability.
- [x] Blueprints machine-readable versionados (`blueprints/golden-saas/capabilities/*.yml`, `schema_version: 1`).

### Phase 5B — Repository Intelligence (Concluída em 2026-09-17)
- [x] Criação do pacote `@mcp-platform/repository-intelligence`.
- [x] Detectors para Rails 8, Next.js, PostgreSQL/PostGIS, Redis, Sidekiq, ActiveStorage, ActiveAdmin, Pundit, Tailwind, shadcn/ui, Docker, GitHub Actions.
- [x] Parsers de routes, schema, models, controllers, policies, services, jobs e admin.
- [x] Scanner estritamente read-only com detecção de segredos e políticas de segurança de paths.
- [x] Testes unitários com fixtures sintéticas.

### Phase 5C — Architecture Graph (Concluída em 2026-09-17)
- [x] Criação do pacote `@mcp-platform/architecture-graph`.
- [x] Grafo de nós (`ROUTE`, `CONTROLLER`, `POLICY`, `MODEL`, `TABLE`, `JOB`, etc.) e arestas (`ROUTES_TO`, `AUTHORIZES_WITH`, `PERSISTS_TO`, `USES`) com `confidence` e `evidence`.
- [x] Mecanismo de consultas de impacto (`ImpactAnalyzer`).
- [x] Testes unitários.

### Phase 5D — SaaS Gap Analyzer (Concluída em 2026-09-17)
- [x] Criação do pacote `@mcp-platform/saas-gap-analyzer`.
- [x] Motor de auditoria com status (`PASS`, `PARTIAL`, `MISSING`, `FAIL`) e prioridades (`P0` a `P3`).
- [x] Gerador de relatório estruturado `GOLDEN_SAAS_GAP_REPORT.md`.
- [x] Validação executada em modo read-only no OEST (Score 73/100) e Avalia Solar (Score 9/100).
- [x] Testes unitários.

### Phase 5E — Feature Engineering Engine (Próxima)
- [ ] Geração de `VerticalSlicePlan` para capabilities faltantes identificadas no Gap Analyzer.

### Phase 5F — Verification Engine
- [ ] Release gates automatizados por stack (Rails, Next.js, Docker, Security).

### Phase 5G — Hotfix Engine
- [ ] Pipeline de incidentes com reprodução, teste de regressão antes do patch e ranking de suspeitos via Architecture Graph.

### Phase 5H — Git / PR Engine
- [ ] Integração com Git para geração de PRs auditáveis com HITL.

### Phase 5I — Production Diagnostics
- [ ] Diagnósticos e saúde de produção read-only.

### Phase 5J — Safe Release Engine
- [ ] Pipeline de release seguro com smoke test e proposta de rollback.

---

## V6 — SaaS Factory (PLANNED)

- [ ] Geração assistida de novos SaaS a partir de requisitos de produto + Golden SaaS Blueprint + Golden Stack canônica.
