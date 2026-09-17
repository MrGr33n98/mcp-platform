# ADR-001 — Plataforma MCP independente e API-first

- Status: Aceita
- Data: 2026-09-17
- Escopo: `mcp-platform`, OEST/DroneHub e Avalia Solar

## Contexto

Dois produtos Rails precisam oferecer capacidades de leitura a clientes AI, sem transformar o agente em um usuário de infraestrutura ou banco. O LastSaaS demonstra um MCP em processo separado que usa `stdio` e encaminha requests read-only para uma API HTTP. Ele é uma referência útil, mas usa Go, MongoDB e convenções de domínio próprias.

## Decisão

Criar e manter `mcp-platform` como workspace TypeScript/Node.js independente, com `core`, cliente Rails HTTP, tools compartilhadas, adapters por produto e um app MCP por produto. V1 usará MCP SDK + Zod + `stdio`, será read-only e falará apenas com APIs Rails versionadas. A Rails API continua responsável por autenticação, TenantScope, Pundit, regras de negócio e PostgreSQL.

## Justificativas

| Pergunta | Decisão e motivo |
|---|---|
| Por que MCP separado dos Rails apps? | Isola ciclo de deploy, dependências, transporte MCP e superfície de agente. Impede acesso incidental a models, console, jobs, filesystem e banco, preservando Rails como fronteira de autorização. |
| Por que TypeScript? | É o stack definido, tem o MCP SDK e Zod, oferece tipagem compartilhável entre registry/client/adapters e reduz custo de manutenção com os produtos web/Rails. |
| Por que API-first? | A API é o único lugar onde políticas, tenancy, auditoria de negócio e serializers podem ser aplicados uniformemente para MCP e demais clientes. |
| Por que read-only V1? | Entrega investigação operacional e comercial com risco drasticamente menor. Evita escrita induzida por prompt antes de existir governança de aprovação. |
| Por que adapters? | Produtos têm vocabulário, endpoints e DTOs próprios, mas compartilham runtime, segurança e tools transversais. Adapters permitem acrescentar produtos sem modificar o core. |
| Por que não acessar banco diretamente? | Bypassaria TenantScope/Pundit, acoplaria o MCP ao schema Rails, criaria risco de cross-tenant/SQL e exigiria segredos de banco no processo de agente. |
| Por que não copiar LastSaaS inteiro? | Seu código é Go/Mongo e seu domínio administrativo não corresponde aos produtos. Reutilizamos os princípios — stdio, proxy HTTP, agrupamento e read-only —, reforçando limites de URL, payload, erro, schema e tenant. |

## Consequências

### Positivas

- Uma mesma plataforma suporta OEST e Avalia com consistência de segurança e observabilidade.
- A API Rails permanece testável e soberana para autorização e dados.
- Uma nova integração é adicionada por adapter/app, sem ciclo ou alteração no core.
- V1 pode ser distribuído com um conjunto pequeno, auditável e explicitamente read-only de tools.

### Custos e riscos aceitos

- Cada produto precisa expor read models Rails específicos para MCP e manter testes de contrato.
- Há uma chamada HTTP adicional e versionamento de contrato a gerir.
- O deploy/configuração passa a incluir um processo MCP e sua credencial de serviço.
- Health e métricas só serão expostos quando a API já tiver uma fonte autorizada e sanitizada.

## Alternativas rejeitadas

- Embutir MCP dentro dos Rails apps: mistura transporte de agente com processo de aplicação e aumenta o risco de acesso interno acidental.
- Um único MCP com branches por produto: introduz condicionais, credenciais e superfícies de tool desnecessárias em cada instalação.
- Acesso direto a PostgreSQL/Redis/Sidekiq: contorna a fronteira de segurança e acopla ao schema.
- Tool genérica para HTTP, SQL, shell ou arquivos: transforma o modelo em controlador de infraestrutura e não é necessária para as capacidades V1.
- Mutations no primeiro lançamento: não há ainda consentimento, preview, idempotência e workflow de aprovação suficientes.

## Revisão

Revisar este ADR antes de V2 (Streamable HTTP) e novamente antes de V3 (mutations governadas). Mudanças que introduzam método HTTP mutável, novo transporte público ou privilégio cross-tenant exigem ADR complementar.
