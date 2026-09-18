# MCP Platform V5J — Safe Release Engine

## 1. Visão Geral e Princípios

O `@mcp-platform/safe-release` é o componente responsável por governar de ponta a ponta a transição entre código verificado e produção:

$$\text{VERIFIED CODE} \to \text{CI} \to \text{RELEASE CANDIDATE} \to \text{CANARY} \to \text{PRODUCTION VERIFICATION} \to \text{RELEASE RECEIPT}$$

### Invariantes Fundamentais de Release
1. $\text{COMMIT} \neq \text{CI\_PASS}$
2. $\text{CI\_PASS} \neq \text{RELEASE\_APPROVED}$
3. $\text{RELEASE\_APPROVED} \neq \text{DEPLOYED}$
4. $\text{DEPLOYED} \neq \text{HEALTHY}$
5. $\text{HEALTHY} \neq \text{VERIFIED}$
6. $\text{INSUFFICIENT\_EVIDENCE} \neq \text{HEALTHY}$ (Telemetria ausente bloqueia auto-promoção).
7. $\text{DEPLOY SUCCESS} \neq \text{PRODUCTION VERIFIED}$ (Apenas o `ProductionVerifier` emite aprovação final).

---

## 2. Arquitetura em Camadas

```text
┌──────────────────────────────────────────────────────────┐
│                   Provenance & CI Layer                  │
│    ProvenanceChainValidator  │  CIPolicy  │  ArtifactVal │
├──────────────────────────────────────────────────────────┤
│                  Approval & Security Layer               │
│    ReleaseApprovalValidator  │  EnvironmentRegistry      │
│    CredentialIsolationPolicy │  DeploymentPolicy         │
├──────────────────────────────────────────────────────────┤
│                 Execution & State Machine                │
│    DeploymentStateMachine   │  ReleaseLock               │
│    DeploymentReconciler     │  DeploymentProvider        │
├──────────────────────────────────────────────────────────┤
│                 Canary & Verification Layer              │
│    CanaryController  │ HealthEvaluator │ PromotionPolicy │
│    ProductionVerifier│ DiagnosticsAdapter                │
├──────────────────────────────────────────────────────────┤
│                Rollback & Receipt Layer                  │
│    RollbackController│ RollbackPolicy  │ RollbackVerifier│
│    ReleaseReceipt    │ RollbackReceipt │ ReleaseReport   │
└──────────────────────────────────────────────────────────┘
```
