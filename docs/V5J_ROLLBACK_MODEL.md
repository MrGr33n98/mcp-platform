# MCP Platform V5J — Controlled Rollback Model

## 1. Rollback como Operação Governada

Um rollback não é um comando ingênuo de "voltar para a imagem anterior". É uma operação governada que exige:
1. Identificação formal de um **`KnownGoodRelease`** com proveniência e digest SHA-256 comprovados.
2. Emissão de `RollbackPlan`.
3. Execução pelo `DeploymentProvider`.
4. Verificação de integridade pós-reversão via `RollbackVerifier`.
5. Emissão de `RollbackReceipt` imutável.

---

## 2. Política de Rollback Automático

- Em ambientes de teste e staging: Rollback automático habilitado.
- Em ambientes de produção: Rollback automático desativado por padrão na versão inicial da V5J, exigindo confirmação/aprovação do operador para mitigar riscos de loops de reinício.
