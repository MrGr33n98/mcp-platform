# MCP Platform V5H — Git Governance Engine Architecture

## 1. Visão Geral & Escopo

O pacote `@mcp-platform/git-governance` é responsável por transformar de maneira controlada, auditável e rastreável um `ApplyReceipt` com status `APPLIED_VERIFIED` em uma alteração Git isolada (branch `mcp/<capability>/<short-id>`), com staging seletivo estrito, verificação de segredos e emissão de commit/PR com rastreabilidade criptográfica.

### Princípios de Fronteira e Autoridade:
```text
WRITE_LOCAL != COMMIT
COMMIT != PUSH
PUSH != PR
PR != MERGE
MERGE != DEPLOY
DEPLOY != PRODUCTION_VERIFIED
```

---

## 2. Pipeline de Execução Transacional

```text
ChangePlan + VerificationReceipt + ApprovalReceipt (for Apply)
                           ↓
              ApplyReceipt(APPLIED_VERIFIED)
                           ↓
                   GitApprovalReceipt
            (Scopes: CREATE_BRANCH, STAGE, COMMIT, PUSH?, CREATE_PR?)
                           ↓
                      GIT PREFLIGHT
        (Receipt Verification, Repo Binding, Branch Policy, Diff Check)
                           ↓
               WORKSPACE CONCURRENCY LOCK
                   (.git_gov_lock)
                           ↓
                    ISOLATED BRANCH
              (mcp/<capability>/<short-id>)
                           ↓
                    SELECTIVE STAGE
              (Declared Files Only — NO Wildcards)
                           ↓
          STAGED DIFF & SECRET SCANNING GATE
        (Regex Patterns + Shannon Entropy > 4.5)
                           ↓
                     GOVERNANCE COMMIT
            (Conventional Format + Provenance)
                           ↓
                  POST-COMMIT VERIFY
              (Tree, Parent, Diff Digest)
                           ↓
                  [OPTIONAL] PUSH
             (Explicit Remote, Isolated Branch)
                           ↓
                 [OPTIONAL] CREATE PR
               (PRPlan, PRBody, Provider)
                           ↓
                      GIT RECEIPT
```

---

## 3. Estrutura do Pacote `@mcp-platform/git-governance`

```text
packages/git-governance/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                      # Exportações públicas
│   ├── types.ts                      # Tipos de dados, receipts e relatórios
│   ├── git-governance-engine.ts       # Orquestrador transacional unificado
│   ├── security/
│   │   ├── git-command-policy.ts     # Allowlist estrita e bloqueio de wildcard/force
│   │   ├── protected-branch-policy.ts# Blindagem de main, master, prod, release/*
│   │   ├── secret-policy.ts          # Padrões regex e cálculo de Shannon Entropy
│   │   └── credential-policy.ts      # Redação de segredos e fingerprints SHA-256
│   ├── git/
│   │   ├── git-client.ts             # Wrapper tipado para o executável git
│   │   ├── branch-manager.ts         # Criação e chaveamento para branches mcp/*
│   │   ├── staging-manager.ts        # Selective staging de caminhos declarados
│   │   ├── commit-manager.ts         # Geração de commit com metadados de rastreabilidade
│   │   └── push-manager.ts           # Push controlado sem force
│   ├── diff/
│   │   ├── diff-parser.ts            # Parser estruturado de unified diffs
│   │   ├── diff-classifier.ts        # Classificação EXPECTED vs UNEXPECTED vs SENSITIVE
│   │   ├── secret-diff-scanner.ts    # Varredura de segredos e entropia no staged diff
│   │   └── generated-file-detector.ts# Detecção de artefatos de build e lockfiles
│   ├── preflight/
│   │   ├── apply-receipt-validator.ts# Validação HMAC, expiração, nonce e digest matching
│   │   ├── repository-validator.ts   # Binding do repositório, commit SHA e dirty tree
│   │   ├── branch-validator.ts       # Validação de regras para branches de destino
│   │   ├── diff-validator.ts         # Validação de diffs pré-operacionais
│   │   └── remote-validator.ts       # Validação de remotes
│   ├── pr/
│   │   ├── pr-plan.ts                # Geração do PRPlan estruturado
│   │   ├── pr-body-generator.ts      # Renderização do corpo do PR (What, Why, Security, Risk)
│   │   └── pr-provider.ts            # Interface e mock de PR providers
│   ├── transactions/
│   │   ├── git-workspace-lock.ts     # Mutex de concorrência mono-agente (.git_gov_lock)
│   │   └── git-operation-journal.ts  # Journal persistente append-only e crash recovery
│   └── reports/
│       └── git-report.ts             # Emissão de GitReceipt e Markdown
└── tests/
    ├── security-policy.test.ts       # 8 testes PASS
    ├── preflight.test.ts             # 6 testes PASS
    ├── secret-scanner.test.ts        # 3 testes PASS
    ├── selective-staging.test.ts     # 3 testes PASS
    ├── branch-manager.test.ts        # 2 testes PASS
    ├── git-client.test.ts            # 3 testes PASS
    └── git-governance-engine.test.ts # 2 testes PASS
```

---

## 4. Garantia de Zero Alteração no OEST Real

O repositório `C:\Users\Bobi\Desktop\drone\dronehub\backend` permaneceu com **ZERO MUTATIONS** no Git. Todos os canaries e validações da Phase 5H foram executados em sandboxes/fixtures temporárias isoladas criadas em `os.tmpdir()`.
