# MCP PLATFORM V5G — MUTATION SECURITY MODEL
## Path Sandboxing, Sensitive File Protection & Forbidden Operations

---

### 1. Modelo de Contenção de Caminhos (Path Sandboxing)

O módulo `security/path-policy.ts` protege contra qualquer tentativa de vazamento ou mutação fora dos limites do workspace:

- **Resolução de Caminhos Reais (`fs.realpathSync`):** Garante que links simbólicos ou junções do Windows (NTFS Junctions) não apontem para fora do workspace raiz.
- **Normalização de Separadores:** Trata barras diretas (`/`) e invertidas (`\`) de forma idêntica e lida com a case-insensitivity do sistema de arquivos Windows (`C:\Users\...`).
- **Bloqueio de Traversal:** Bloqueia terminantemente `..`, caminhos com barra inicial (`/etc/passwd`), caminhos absolutos com letras de drive (`C:\Windows\...`), caminhos UNC (`\\server\share`) e caminhos de dispositivo (`\\.\COM1`).

---

### 2. Política de Arquivos Protegidos (`security/file-policy.ts`)

Os seguintes padrões de arquivos são classificados como **PROTECTED** e possuem escrita incondicionalmente bloqueada:

- `.env*` (todos os arquivos de variáveis de ambiente e segredos locais)
- `config/master.key` (chave mestra de decodificação de credenciais Rails)
- `config/credentials.yml.enc` e `config/secrets.yml.enc`
- `*.pem`, `*.key` (certificados TLS e chaves privadas)
- `id_rsa*`, `id_ed25519*` (chaves de autenticação SSH)
- `.git/*` (metadados internos do repositório Git)

---

### 3. Operações Terminantemente Proibidas na Phase 5G

1. **`DELETE_FILE`:** Bloqueado por default na baseline V5G para minimizar o raio de impacto.
2. **`RENAME_FILE`:** Bloqueado por default na baseline V5G.
3. **Shell Commands Arbitrários:** É estritamente proibido usar comandos como `echo > file`, `sed -i`, `rm`, `mv` ou encadeamento de shell (`;`, `|`, `` ` ``, `$()`). Todas as alterações devem ocorrer via API nativa e segura de filesystem (`node:fs/promises`).
4. **Execução de `rails db:migrate`:** A criação do arquivo de migration em `db/migrate/` é permitida, mas a execução de migrações em banco real é proibida nesta fase.
5. **Git Writes:** Comandos de escrita no Git (`git commit`, `git push`, `git reset`, `git checkout`, `git clean`) permanecem bloqueados.
