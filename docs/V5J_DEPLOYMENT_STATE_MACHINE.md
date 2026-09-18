# MCP Platform V5J — Deployment State Machine

## 1. Diagrama de Estados e Transições

```text
       CREATED
          ↓
     CI_VERIFIED (ou CI_FAILED)
          ↓
    APPROVAL_PENDING
          ↓
       APPROVED
          ↓
      PREPARING
          ↓
  CANARY_DEPLOYING ──(Crash)──> DeploymentReconciler
          ↓
  CANARY_OBSERVING
    ┌─────┴────────────────┐
    │                      │
CANARY_HEALTHY       CANARY_FAILED
    │                      │
PROMOTION_PENDING          │
    │                      │
PROMOTING                  │
    │                      │
PRODUCTION_DEPLOYED        │
    │                      │
PRODUCTION_VERIFYING       │
    │                      │
PRODUCTION_VERIFIED        ↓
                   ROLLBACK_REQUIRED
                           ↓
                      ROLLING_BACK
                           ↓
                      ROLLED_BACK
```

---

## 2. Guards de Transição

Nenhuma transição de estado ocorre por mutação arbitrária. Cada passo requer recibos criptográficos válidos, evidência de saúde e verificação de invariantes.
