# MCP Platform V5H — Git Security & Policy Model

## 1. Princípio de Menor Privilégio no Git

A plataforma opera sob um modelo restrito onde operações de Git são estritamente governadas por políticas programáticas.

### Tabela de Autoridades:

| Operação Git | Autoridade Requerida | Política de Segurança |
| :--- | :--- | :--- |
| `status`, `diff`, `rev-parse`, `ls-files` | `READ_ONLY` | Permitido para inspeção do estado. |
| `switch -c mcp/...` | `CREATE_BRANCH` | Bloqueado para branches protegidas (`main`, `master`, `prod`, `release/*`). |
| `add <explicit files>` | `STAGE` | **Strict Selective Staging**. Bloqueio incondicional de wildcards (`.`, `-A`, `*`). |
| `commit -m ...` | `COMMIT` | Exige staged diff 100% consistente com o `ChangePlan` e zero secrets. |
| `push -u remote branch` | `PUSH` (Explícito) | Somente branch isolada. **Proibido** `--force`, `-f`, `--force-with-lease`. |
| `create_pr` | `CREATE_PR` (Explícito) | Criação de PR via `PullRequestProvider`. **Proibido auto-merge**. |
| `reset --hard`, `clean -fd`, `rebase` | **PROIBIDO** | Comandos destrutivos de histórico são bloqueados no policy layer. |

---

## 2. Bloqueio Anti-Wildcard (`NO git add .`)

Wildcards permitem que arquivos locais não intencionais, rascunhos ou segredos temporários sejam acidentalmente incluídos no commit.

O `GitCommandPolicy` e o `StagingManager` validam cada argumento:
```typescript
if (arg === "." || arg === "-A" || arg === "--all" || arg === "*" || arg.includes("*")) {
  throw new GitSecurityViolationError("Wildcard or bulk staging is strictly forbidden.");
}
```

---

## 3. Política de Branches Protegidas (`ProtectedBranchPolicy`)

Commits diretos em branches principais são bloqueados. Toda alteração automatizada deve ser realizada em uma branch isolada no formato:
```text
mcp/<capability-sanitizada>/<short-id>
Exemplo: mcp/outgoing-webhooks/tx8f192b
```

Branches protegidas por padrão:
- `main`
- `master`
- `production`
- `prod`
- `staging`
- `release/*`

---

## 4. Secret Scanning & Heurística de Entropia

Antes de qualquer commit, o staged diff (`git diff --cached`) é inspecionado linha por linha:

1. **Padrões de Expressões Regulares:**
   - AWS Access Keys (`AKIA...`)
   - Stripe Secret & Restricted Keys (`sk_live_...`, `rk_live_...`)
   - GitHub Personal Access Tokens (`ghp_...`)
   - Chaves privadas RSA / EC / DSA / OpenSSH
   - Rails Master Keys (`RAILS_MASTER_KEY=...`)
   - JWT Tokens e Connection Strings com senhas
2. **Heurística de Entropia de Shannon:**
   - Strings com comprimento $\ge 24$ caracteres são avaliadas.
   - Entropia $\ge 4.8$ $\to$ `CONFIRMED_SECRET` (bloqueio incondicional do commit).
   - Entropia entre $4.5$ e $4.8$ $\to$ `LIKELY_SECRET`.
3. **Redação Integral:**
   - O fingerprint retornado mascara os caracteres e exibe apenas os primeiros 4 caracteres e o SHA-256 do segredo. Segredos brutos nunca são gravados nos logs ou relatórios.
