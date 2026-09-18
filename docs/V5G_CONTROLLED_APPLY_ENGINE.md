# MCP PLATFORM V5G — CONTROLLED APPLY ENGINE
## Atomic Code Application, Mutation Safety Gate & Rollback Orchestration

---

### 1. Visão Geral da Arquitetura

O **Apply Engine** (`@mcp-platform/apply-engine`) é o motor de execução da plataforma Golden SaaS, responsável por transformar um `ChangePlan` previamente **verificado** pelo `VerificationEngine` e **aprovado** pelo operador humano em alterações locais controladas, auditáveis e 100% reversíveis.

```text
ChangePlan
     +
VerificationReceipt (Status: PASS)
     +
ApprovalReceipt (Authenticated Signature & Scope)
     +
Current Repository Revision (Anti-TOCTOU Lock)
          ↓
     [ PRE-FLIGHT ]
          ↓
     [ Mutation Sandbox & WorkspaceLock ]
          ↓
     [ Byte-for-Byte WorkspaceSnapshot ]
          ↓
     [ Atomic Apply (Ordered by DAG) ]
          ↓
     [ Post-Apply Diff & Verification Engine ]
          ↓
PASS ─────────────→ [ AppliedChangeSet + ApplyReceipt ]
FAIL ─────────────→ [ Automatic Rollback + RollbackVerificationReport ]
```

---

### 2. Invariantes Absolutos Enforçados

| Invariante | Mecanismo de Proteção | Comportamento em caso de Violação |
| :--- | :--- | :--- |
| **NO VERIFICATION RECEIPT → NO APPLY** | `ReceiptChainValidator` | Rejeição imediata antes de qualquer operação |
| **NO APPROVAL RECEIPT → NO APPLY** | `ReceiptChainValidator` | Rejeição imediata sem autorização humana/criptográfica |
| **STALE VERIFICATION / STALE APPROVAL** | `ReceiptChainValidator` (`expires_at`) | Rejeição por expiração temporal de recibo |
| **REPOSITORY CHANGED (Anti-TOCTOU)** | `RevisionValidator` (Git Commit Match) | Bloqueio imediato se o commit HEAD divergir |
| **PLAN DIGEST MISMATCH** | `PlanValidator` (SHA-256 Digest Match) | Rejeição se o plano sofrer qualquer adulteração |
| **PATH OUTSIDE WORKSPACE** | `PathPolicy` (Realpath containment) | Bloqueio de caminhos absolutos externos ou `..` |
| **UNDECLARED FILE MUTATION** | `DiffValidator` (PLANNED vs ACTUAL) | Falha imediata e acionamento de Rollback |
| **POST-APPLY TEST FAILURE** | `PostApplyVerifier` | Falha imediata e acionamento de Rollback |
| **PARTIAL APPLY** | `MutationEngine` (Transação Lógica) | Interrupção imediata e acionamento de Rollback |
| **NO BACKUP/SNAPSHOT** | `WorkspaceSnapshotManager` | Bloqueio pré-escrita se o snapshot não for gerado |
| **NO HUMAN APPROVAL → NO WRITE** | `ReceiptChainValidator` (Scope & Signature) | Bloqueio total de autoridade de escrita |

---

### 3. Pipeline de Execução Passo a Passo

1. **Pre-flight Gate:**
   - Valida integridade do workspace (`WorkspaceValidator`).
   - Recalcula e confirma o SHA-256 do plano (`PlanValidator`).
   - Valida a cadeia criptográfica de recibos (`ReceiptChainValidator`).
   - Checa se o worktree contém alterações não salvas (`DirtyTreeValidator`).
   - Bloqueia se o commit SHA divergir do momento da verificação (`RevisionValidator`).
2. **Locking & Snapshot:**
   - Adquire a trava exclusiva do workspace (`WorkspaceLock`) para evitar concorrência.
   - Cria o snapshot byte-a-byte de todos os arquivos alvos em `.apply_snapshots/<txId>/`.
   - Inicializa o log transacional append-only em `.apply_journals/<txId>.json`.
3. **Revalidação Imediata Anti-TOCTOU:**
   - Imediatamente antes de abrir o primeiro descritor de arquivo, reconfirma o Git HEAD.
4. **Execução de Mutações:**
   - Executa cada operação na ordem DAG (`CREATE_FILE`, `MODIFY_FILE`, `PATCH_FILE`).
   - Para arquivos modificados, valida `expected_before_hash` para evitar lost updates.
   - Grava cada transição no diário de mutações.
5. **Validação de Diff & Pós-Verificação:**
   - Compara a superfície real alterada com a planejada (`DiffValidator`).
   - Invoca o `VerificationEngine` contra os arquivos materializados (`PostApplyVerifier`).
6. **Finalização ou Rollback:**
   - Se tudo for aprovado: emite `ApplyReceipt` com `applied_change_digest` SHA-256 e libera o lock.
   - Se qualquer passo falhar: aciona `RollbackManager`, restaura os arquivos byte-a-byte, remove novos arquivos gerados e emite `RollbackVerificationReport`.
