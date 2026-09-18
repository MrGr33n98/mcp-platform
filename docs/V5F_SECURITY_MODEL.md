# MCP PLATFORM V5F — SECURITY MODEL
## Multi-Layer Security Architecture, Environment Isolation & Secret Protection

---

### 1. Modelo de Defesa em Profundidade (Defense-in-Depth)

A segurança da Phase 5F do MCP Platform é desenhada sob o princípio de **privilégio mínimo absoluto** e **zero-trust execution**:

```text
┌─────────────────────────────────────────────────────────────┐
│                    VERIFICATION ENGINE                      │
├──────────────────────────────┬──────────────────────────────┤
│ Command Allowlist & Sandbox  │ Environment Policy (No Prod) │
├──────────────────────────────┼──────────────────────────────┤
│ Secret Redactor & Sanitizer  │ SSRF / Network Defense       │
├──────────────────────────────┼──────────────────────────────┤
│ Strict Tenancy Enforcement   │ Cryptographic Receipts       │
└──────────────────────────────┴──────────────────────────────┘
```

---

### 2. Prevenção e Bloqueio de Comandos Perigosos

A camada de segurança (`security/command-policy.ts`) intercepta e bloqueia ativamente qualquer tentativa de execução não autorizada:

#### Bloqueio de Injeção de Shell & Caracteres de Controle:
- Caracteres terminadores e encadeadores proibidos: `;`, `&`, `|`, `&&`, `||`, `` ` ``, `$()`, `>`, `<`, `\n`.
- Bloqueio de comandos de mutação destrutiva: `rm`, `del`, `drop`, `truncate`, `kill`, `pkill`, `format`, `dd`.
- Bloqueio de mutações em Git/Repositório: `git push`, `git reset`, `git checkout`, `git rebase`, `git commit`.

#### Allowlist Restrita de Comandos:
Apenas 3 classes de comandos são admitidas pelo runner:
1. **`READ_ONLY`:** `git status`, `git rev-parse`, `bundle exec rails routes`, `cat`, `ls`.
2. **`SAFE_BUILD`:** `npm run build`, `npm run typecheck`, `tsc`, `bundle exec rails assets:precompile`.
3. **`SAFE_TEST`:** `npm test`, `vitest run`, `bundle exec rspec`, `bundle exec rails test`.

---

### 3. Isolamento Estrito de Ambientes (`security/environment-policy.ts`)

A execução de qualquer teste ou build é terminantemente proibida em ambientes de produção:

- **Variáveis de Ambiente Bloqueadas:**
  - `RAILS_ENV=production` ou `RACK_ENV=production` $\to$ **BLOCKER**
  - `NODE_ENV=production` $\to$ **BLOCKER**
  - `DATABASE_URL` contendo domínios como `prod`, `production`, `aws.rds`, `cockroachlabs.cloud` sem flag de homologação $\to$ **BLOCKER**
- **Bloqueio de Chaves Reais de Gateways:**
  - Chaves Stripe Live (`sk_live_...`) ou OpenAI Live (`sk-proj-...`) detectadas no ambiente $\to$ **BLOCKER**.

---

### 4. Proteção de Segredos & Redação Automática (`security/secret-redactor.ts`)

Todas as saídas de stdout/stderr, logs e relatórios JSON/Markdown passam por sanitização obrigatória:

1. **Padrões de Segredos Mascarados:**
   - OpenAI / Groq / Anthropic API Keys: `sk-[a-zA-Z0-9_-]{20,}` $\to$ `[REDACTED_API_KEY]`
   - GitHub Personal Access Tokens: `ghp_[a-zA-Z0-9]{36}` $\to$ `[REDACTED_GH_TOKEN]`
   - Senhas em URIs de Bancos de Dados: `postgres://user:password@host...` $\to$ `postgres://user:[REDACTED_PASSWORD]@host...`
   - Headers de Autorização: `Bearer <token>` $\to$ `Bearer [REDACTED_TOKEN]`
2. **Sanitização de Terminal (`security/output-sanitizer.ts`):**
   - Remoção de códigos de escape ANSI / VT100 para evitar injeções visuais em consoles e relatórios.

---

### 5. Proteção Avançada contra SSRF (Server-Side Request Forgery)

O `SecurityValidator` exige que todos os despachadores de webhooks ou integrações HTTP externas implementem:
- **Resolução de DNS em Tempo de Execução:** Validação de IP imediatamente antes da chamada HTTP (prevenção de DNS Rebinding / TOCTOU de rede).
- **Bloqueio de Ranges Privados e Reservados:**
  - `127.0.0.0/8` (Loopback)
  - `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` (RFC 1918 Private Networks)
  - `169.254.0.0/16` (Link-Local / AWS/GCP/Azure Metadata Services `169.254.169.254`)
  - `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 Private & Link-Local)
- **Bloqueio de Protocolos Perigosos:** Proibição de schemes diferentes de `http` e `https` (`file://`, `gopher://`, `ftp://`).
