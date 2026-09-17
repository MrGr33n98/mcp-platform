# Roadmap

## V0 — Architecture (esta fase)

- Auditar workspace e corrigir `.gitignore`.
- Estudar LastSaaS como referência arquitetural, não dependência de código.
- Definir limites API-first, contratos, adapters, tool taxonomy e threat model.
- Criar os documentos de arquitetura e o ADR.
- Não implementar MCP, não instalar biblioteca, não alterar OEST/Avalia.

Critério de saída: decisões e interfaces revisáveis, sem blocker arquitetural real.

## V1 — Core + stdio + HTTP client + tools read-only

- Configurar workspace TypeScript e packages, incluindo MCP SDK e Zod somente quando iniciar a implementação.
- Implementar `core`: registry, config, contexto, erros, logging/audit e limites.
- Implementar `RailsApiClient`: HTTPS allowlisted, Bearer, timeout, abort, tamanho máximo, redaction e erro normalizado.
- Implementar transport `stdio`, mantendo stdout exclusivo ao protocolo.
- Implementar shared tools e fixtures/testes unitários de schemas, URL, erros, limites e redaction.
- Registrar somente tools V1 read-only e validar que nenhum método fora de `GET` pode ser chamado.

Critério de saída: servidor local MCP validado por testes sem acesso a banco/shell/filesystem e com auditoria segura.

## V1.1 — Integração OEST em produção

- Definir read models e policies `/api/mcp/v1` no Rails OEST em tarefa própria.
- Implementar `OestAdapter` e `apps/oest-mcp`.
- Integrar organização, missões, operadores, quote/order/deliverable, failed jobs e capabilities shared aprovadas.
- Adicionar testes de contrato Rails ↔ adapter, cenários de negação e cross-tenant.
- Configurar observabilidade, rate limits, rotação de key e rollout controlado.

Critério de saída: ferramentas OEST exibem apenas dados permitidos pelo tenant/principal e atendem SLOs definidos.

## V1.2 — Integração Avalia Solar

- Definir read models e policies `/api/mcp/v1` no Rails Avalia em tarefa própria.
- Implementar `AvaliaAdapter` e `apps/avalia-mcp`.
- Integrar company, reviews, leads, pipeline, downloads e capabilities shared disponíveis.
- Executar suíte de contrato e threat tests equivalentes ao OEST.

Critério de saída: Avalia reutiliza core sem alteração de OEST e com isolamento completo de companies.

## V2 — Streamable HTTP

- Adicionar transport Streamable HTTP como app/adapter de transporte, preservando tools e contratos.
- Definir autenticação de transporte, CORS, sessão, origin validation, proxy/ingress e rate limiting público.
- Manter `stdio` compatível para instalações locais.

Critério de saída: o mesmo registry opera em ambos os transports sem mudança de semântica ou redução de controles.

## V3 — Mutations governadas

- Aprovar ADRs por classe de mutation, com tools específicas e nunca genéricas.
- Implementar preview, confirmação humana, payload hash, idempotency key, audit imutável e limites de impacto.
- Reforçar policies Rails e fluxos de compensação/rollback.

Critério de saída: nenhuma escrita é possível sem autorização, confirmação vinculada e trilha auditável ponta a ponta.

## V4 — Workflow de aprovação por agente

- Criar fila de propostas de ação, UI/integração de aprovação e expiração de consentimento.
- Separar quem solicita, quem aprova e quem executa quando o risco exigir.
- Disponibilizar status, justificativa, diff/preview e resultado de cada proposta.

Critério de saída: operações sensíveis têm governança humana verificável e métricas de segurança/uso.
