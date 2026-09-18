# MCP PLATFORM V5F — COMMAND EXECUTION POLICY
## Strict Command Allowlist, Working Directory Sandbox & Execution Timeouts

---

### 1. Princípios de Execução de Comandos

O submódulo `runners/command-runner.ts` é o único ponto de entrada para execução de comandos do sistema operacional durante a fase de verificação. Ele implementa salvaguardas rígidas:

1. **Zero Shell Evaluation (`shell: false`):** Comandos são invocados via spawn com argumentos tokenizados, prevenindo qualquer tipo de shell interpolation.
2. **Workspace Sandboxing:** A execução é estritamente restrita aos limites do repositório ou monorepo. Qualquer tentativa de executar comandos em `/tmp`, diretórios de sistema (`/etc`, `C:\Windows`) ou fora do workspace é rejeitada antes do spawn.
3. **Timeouts Imutáveis:** Cada classe de comando possui um limite rígido de tempo de execução para evitar denial-of-service ou processos zumbis.

---

### 2. Tabela de Allowlist de Comandos e Timeouts

| Comando | Classe | Timeout Máximo | Finalidade Permitida |
| :--- | :--- | :--- | :--- |
| `git status` | `READ_ONLY` | 5.000 ms | Inspeção de estado da working tree |
| `git rev-parse HEAD` | `READ_ONLY` | 5.000 ms | Obtenção do commit SHA canônico |
| `git branch --show-current` | `READ_ONLY` | 5.000 ms | Obtenção da branch ativa |
| `bundle exec rails routes` | `READ_ONLY` | 30.000 ms | Inspeção de rotas do Rails backend |
| `npm run typecheck` | `SAFE_BUILD` | 60.000 ms | Verificação estática de tipos TypeScript |
| `npm run build` | `SAFE_BUILD` | 60.000 ms | Validação de compilação sem efeitos colaterais |
| `tsc --noEmit` | `SAFE_BUILD` | 60.000 ms | Checagem TypeScript |
| `npm test` | `SAFE_TEST` | 90.000 ms | Execução de testes de integração e unitários |
| `vitest run` | `SAFE_TEST` | 60.000 ms | Execução de testes de pacotes TypeScript |
| `bundle exec rspec` | `SAFE_TEST` | 120.000 ms | Execução de specs Rails em ambiente de teste |

---

### 3. Comandos Terminantemente Proibidos (Blacklist Mandatória)

Qualquer comando contendo ou iniciando com as seguintes instruções gera falha imediata com veredito `COMMAND_BLOCKED`:

```text
git push
git commit
git reset
git checkout (exceto read-only)
git clean
rm -rf / del /s
rails db:drop
rails db:reset
rails db:migrate (em modo VERIFY_ONLY)
curl | sh
wget | sh
eval
powershell -Command "..." (injetado)
```

---

### 4. Tratamento de Saídas e Erros

- **Captura Segura de STDOUT/STDERR:** Buffers limitados a 10MB para evitar estouro de memória.
- **Redação Automática:** Segredos de API, senhas e tokens são substituídos por marcadores `[REDACTED]` antes de serem retornados ao `VerificationReport`.
- **Exit Code Normalization:** Qualquer exit code $\neq 0$ é mapeado para `status: "FAILED"`, registrando a saída sanitizada para auditoria forense.
