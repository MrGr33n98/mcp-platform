# MCP PLATFORM V5G — ROLLBACK MODEL
## Byte-for-Byte Snapshots, Mutation Journaling & Recovery Verification

---

### 1. Filosofia de Rollback Transacional

Na plataforma Golden SaaS, a aplicação de código é tratada como uma **transação lógica atômica**. O sistema adota o princípio de **Fail-Closed**: se qualquer anomalia ocorrer durante ou após as mutações, a transação inteira é desfeita.

```text
       BEGIN TRANSACTION
              ↓
  [ Byte-for-Byte Snapshot ]
              ↓
      [ Apply Mutations ] ──(Error)──┐
              ↓                      │
    [ Diff Verification ] ──(Error)──┤
              ↓                      │
    [ Post-Apply Verify ] ──(Error)──┤
              ↓                      ↓
      COMMIT TRANSACTION     [ AUTOMATIC ROLLBACK ]
                                     ↓
                         [ Byte-Exact Restoration ]
                                     ↓
                         [ RollbackVerificationReport ]
```

---

### 2. Snapshots Pré-Mutação (`WorkspaceSnapshotManager`)

- **Isolamento de Diretório:** Snapshots são salvos em `.apply_snapshots/<transaction_id>/`.
- **Cálculo de SHA-256 Byte-a-Byte:** Cada arquivo alvo existente é lido e recebe um hash SHA-256 antes de qualquer escrita.
- **Armazenamento Seguro:** Arquivos existentes são salvos como backups brutos; arquivos novos recebem marcação `existed_before: false`.

---

### 3. Procedimento de Restauração (`RollbackManager`)

1. **Remoção de Arquivos Criados:** Apenas arquivos que foram criados pela transação atual e que não existiam antes são removidos do disco.
2. **Restauração de Arquivos Modificados:** Cada arquivo modificado tem seu conteúdo original restaurado a partir do snapshot.
3. **Verificação Pós-Rollback:** Todos os arquivos são relidos e seus hashes SHA-256 são comparados com o snapshot original.
4. **Relatório de Auditoria:** O `RollbackVerificationReport` é emitido com `status: "SUCCESS"` somente quando 100% dos hashes conferem e 0 discrepâncias são detectadas.

---

### 4. Diário de Mutações (`MutationJournalManager`)

O log append-only registra cada transição de estado:
- `PENDING`: Operação registrada antes da tentativa de mutação.
- `APPLIED`: Escrita concluída no disco com novo hash registrado.
- `VERIFIED`: Pós-verificação concluída com sucesso.
- `ROLLED_BACK`: Transação revertida com sucesso pós-falha.
- `FAILED`: Falha na operação ou no processo de rollback.
