# MCP Platform V5H — Pull Request Governance

## 1. Princípios de Governança de PR

- **CREATE_PR != MERGE:** A criação de um Pull Request submete as alterações verificadas para revisão humana e pipelines de CI. A plataforma MCP não realiza auto-merge nesta fase.
- **Provider Abstraction (`PullRequestProvider`):** A camada de PR é desacoplada da infraestrutura de hospedagem (GitHub, GitLab, Bitbucket ou provedores locais/mocks).
- **Sem Tokens no Plano:** Credenciais e tokens de API do GitHub permanecem exclusivamente no runtime do provedor e nunca são persistidos em planos ou recibos.

---

## 2. Estrutura Padrão do PR Gerado

O corpo do Pull Request é construído automaticamente com seções técnicas e detalhadas:

1. **🎯 Overview:**
   - **What:** Descrição objetiva da alteração.
   - **Why:** Justificativa arquitetural e capability correspondente.
2. **🏗️ Architecture & Changes:**
   - Base branch e head branch isolada.
   - Lista exata de arquivos criados e modificados com flags `[NEW]` e `[MOD]`.
   - Impacto em banco de dados (migrações reversíveis).
   - Impacto em rotas e contratos de API.
3. **🔒 Security & Tenancy:**
   - Garantia de isolamento multi-tenant (Pundit Scopes).
   - Confirmação de Secret Scanning PASS (0 segredos).
4. **🧪 Tests & Verification:**
   - Status de verificação do plano e testes locais executados.
5. **⚠️ Risk & Rollback:**
   - Nível de risco estimado.
   - Procedimento explícito de rollback e commit SHA de restauração.
6. **🏷️ Provenance & Tracking IDs:**
   - Tabela de rastreabilidade contendo `ChangePlan Digest`, `Verification Digest`, `Apply ID` e `Approval ID`.
