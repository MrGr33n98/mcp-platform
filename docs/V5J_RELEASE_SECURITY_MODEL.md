# MCP Platform V5J — Release Security Model

## 1. Isolamento de Credenciais e Zero Raw Shell

- **Proibição de Raw Shell:** Comandos genéricos de terminal (`ssh`, `docker run`, `kubectl apply`) são expressamente proibidos em planos e ChangePlans. O motor opera exclusivamente através de interfaces tipadas do `DeploymentProvider`.
- **Sanitização de Credenciais:** Tokens, segredos, senhas e chaves privadas nunca são expostos em `ChangePlan`, `ReleaseCandidate`, `ReleaseReceipt` ou logs de execução.

---

## 2. Replay Protection & Escopos de Aprovação

Toda aprovação de release (`ReleaseApprovalReceipt`) possui:
- `nonce` criptográfico único (registrado e invalidado após o primeiro uso).
- Data de expiração (`expires_at`) estrita.
- Amarração com o SHA do commit, digest do artefato e ambiente alvo.
- **Isolamento de Escopo:** Aprovação para `DEPLOY_CANARY` **NÃO** autoriza `PROMOTE_PRODUCTION`. Cada transição crítica exige aprovação com escopo correspondente.

---

## 3. Concorrência e Release Locks

Para prevenir *race conditions* ou deploys simultâneos conflitantes em produção, o `ReleaseLock` assegura que apenas **1 mutação de release ativa** ocorra por par `(produto, ambiente)`.
