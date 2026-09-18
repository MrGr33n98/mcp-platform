# MCP PLATFORM V5F — VERIFICATION ENGINE
## Plan Verification, Test Orchestration & Release Evidence Architecture

---

### 1. Visão Geral & Princípios Fundamentais

O **Verification Engine** (`@mcp-platform/verification-engine`) é a camada autônoma de governança e auditoria pré-aplicação da plataforma Golden SaaS. Ele atua como o **Gate Mandatório de Segurança e Conformidade**, assegurando que nenhum plano de alteração de software gerado pelo `FeatureEngineeringEngine` possa ser aplicado aos repositórios alvo sem verificação criptográfica, estrutural, de isolamento de tenant e de segurança em profundidade.

#### Regra Fundamental do Ciclo de Vida:
```text
PLAN_CREATED != PLAN_VERIFIED
PLAN_VERIFIED != CODE_APPLIED
CODE_APPLIED != RELEASED
RELEASED != PRODUCTION_VERIFIED
```

Nesta fase (5F), o sistema opera estritamente sob o modo `VERIFY_ONLY` (`STATIC_VERIFY`, `SAFE_TEST`, `SAFE_BUILD`), com **Zero Write** permitido aos repositórios alvo (`OEST`, `Avalia Solar`).

---

### 2. Fluxo da Pipeline e Prevenção de TOCTOU

```text
Repository Intelligence
         ↓
Architecture Graph
         ↓
Gap Analyzer
         ↓
Feature Engineering Engine ──→ [ ChangePlan + VerticalSlicePlan ]
                                            ↓
                               ┌───────────────────────────────┐
                               │   VERIFICATION ENGINE (5F)    │
                               │                               │
                               │  1. Capture Git Revision      │
                               │  2. Specialized Validators    │
                               │  3. Profile Static Verifiers  │
                               │  4. Surface & Blast Radius    │
                               │  5. SHA-256 Receipts & Report │
                               └───────────────────────────────┘
                                            ↓
                               [ VerificationReport ] (PASS / FAIL)
                                            ↓
                               [ VerificationReceipt (SHA-256) ]
                                            ↓
                               [ Human Approval Gate ]
                                            ↓
                               Future Apply Engine (5G)
```

#### Prevenção de TOCTOU (Time-of-Check to Time-of-Use):
Para evitar divergência entre o momento em que o plano foi verificado e o momento em que ele eventualmente venha a ser aplicado:
1. **`change_plan_digest` (SHA-256):** O plano de alterações é canonicamente serializado e recebe um hash SHA-256 de 64 caracteres.
2. **`repository_revision`:** O commit Git exato (`commitSha`), a branch e o estado da working tree (`dirty: boolean`) são capturados no instante da validação.
3. **`verification_digest` (SHA-256):** O recibo criptográfico concatena `verificationId`, `change_plan_digest`, `commitSha` e `verification_status`. Qualquer alteração posterior no código-fonte ou no plano anula instantaneamente a validade do recibo.

---

### 3. Matriz de Validadores Especializados

O `VerificationEngine` orquestra 11 validadores modulares:

| Validador | Componente | Responsabilidade | Regra de Corte |
| :--- | :--- | :--- | :--- |
| **EvidenceValidator** | `validators/evidence-validator.ts` | Confirma evidências do Gap Report e existência do modelo de tenant | `NO EVIDENCE → FAIL` |
| **PatternValidator** | `validators/pattern-validator.ts` | Valida aderência às convenções dominantes (`ApplicationJob`, `Pundit`, `Api::V1::BaseController`) | `DEVIATION → FAIL` |
| **DependencyValidator** | `validators/dependency-validator.ts` | Garante ordenação do DAG de operações (Migration $\to$ Model $\to$ Policy $\to$ Service $\to$ Job $\to$ Ctrl $\to$ Test) | `CYCLIC/INVALID → FAIL` |
| **OperationValidator** | `validators/operation-validator.ts` | Garante caminhos relativos seguros e ausência de colisão de caminhos duplicados | `COLLISION → FAIL` |
| **ArchitectureValidator** | `validators/architecture-validator.ts` | Checa colisão de símbolos contra os nós existentes no grafo arquitetural | `SYMBOL CONFLICT → FAIL` |
| **MigrationValidator** | `validators/migration-validator.ts` | Valida reversibilidade, UUID PKs, FK constraints, chave de tenant e índices | `UNSAFE / NON-REVERSIBLE → FAIL` |
| **PolicyValidator** | `validators/policy-validator.ts` | Garante autorização Pundit com `ApplicationPolicy::Scope` e tenant isolation | `NO TENANT SCOPE → FAIL` |
| **APIContractValidator** | `validators/api-contract-validator.ts` | Garante mapeamento 100% de rotas para actions e schemas de request/response | `UNMAPPED ROUTE → FAIL` |
| **TestPlanValidator** | `validators/test-plan-validator.ts` | Exige suíte de testes protetores cobrindo model, controller e cross-tenant | `NO TEST PLAN → FAIL` |
| **SecurityValidator** | `validators/security-validator.ts` | Validação de SSRF avançado (anti-DNS rebinding, loopback, link-local, private IP), HMAC-SHA256 e AES-GCM | `INSECURE CIPHER/SSRF → FAIL` |
| **RollbackValidator** | `validators/rollback-validator.ts` | Exige plano de reversão explícito passo a passo com garantia de reversão segura | `NO ROLLBACK → FAIL` |

---

### 4. Análise de Superfície e Raio de Impacto

#### Change Surface Report (`reports/change-surface.ts`):
Quantifica de forma determinística:
- Total de arquivos a criar / modificar / remover.
- Linhas de código estimadas.
- Tabelas, colunas, foreign keys e índices criados.
- Rotas e controllers adicionados.
- Testes planejados por categoria.

#### Blast Radius Analyzer (`reports/blast-radius.ts`):
Classifica o risco das alterações em:
- **Impacto Direto:** Nós diretamente manipulados (tabelas, models, controllers).
- **Impacto Transitivo:** Dependências afetadas a jusante e a montante.
- **Componentes Críticos:** Detecção de impacto em modelos de faturamento, autenticação e tenant base (`Organization`, `ApiKey`).
- **Nível de Risco Geral:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Testes Protetores Requeridos:** Mapeamento explícito de quais specs cobrem a área afetada.

---

### 5. Emissão de Recibos Criptográficos

O `VerificationEngine` produz dois tipos de recibo JSON:
1. **`VerificationReceipt` (`VERIFICATION_RECEIPT`):**
   ```json
   {
     "schema_version": 1,
     "receipt_type": "VERIFICATION_RECEIPT",
     "verification_id": "VERIF-1789689255588-B24DUA",
     "change_plan_digest": "e09a968b3b30875517bfaef31d910087a7eea9d8a6bbe624cbe225e324555eee",
     "repository_revision": {
       "commitSha": "8326d3538a2f",
       "branch": "main",
       "dirty": true,
       "capturedAt": "2026-09-17T23:54:15.589Z"
     },
     "verification_status": "PASS",
     "verification_digest": "24bc57aba12435cabae1e8136d4dbe22546cd44a4ad46033f70bdb6cd2655ae8",
     "timestamp": "2026-09-17T23:54:15.589Z"
   }
   ```
2. **`ApprovalReceipt` (`APPROVAL_RECEIPT`):** Emitido quando um operador humano autoriza a progressão para aplicação pós-revisão.
