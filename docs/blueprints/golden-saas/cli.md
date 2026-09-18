# Golden SaaS Blueprint — Developer CLI & Tooling

## 1. Overview & Conceptual Architecture

A **Developer CLI & Ferramental de Operação** permite aos engenheiros e clientes gerenciar recursos, executar tarefas de manutenção, exportar dados e disparar ações operacionais diretamente pelo terminal.

- **Reference Implementation (LastSaaS):** Node.js CLI / Commander / oclif.
- **Golden Stack Adaptation:** TypeScript/Node.js CLI (`@mcp-platform/cli` ou binários específicos) + Thor / Rake Tasks no Rails + MCP Stdio Interface.

---

## 2. CLI Architecture & Commands

```
saas-cli
├── auth:login              # Autentica e armazena token em ~/.saas/config.json
├── api-keys:list           # Lista chaves ativas do tenant
├── api-keys:create         # Cria nova chave com escopos definidos
├── jobs:status             # Consulta filas do Sidekiq
├── audit:tail              # Stream em tempo real de logs de auditoria
└── health                  # Diagnóstico geral de conectividade e status
```

---

## 3. Verification & Test Suite

- `spec/cli/commands_spec.rb`: Teste de execução de comandos com saída JSON e tratamento de erro de rede.
