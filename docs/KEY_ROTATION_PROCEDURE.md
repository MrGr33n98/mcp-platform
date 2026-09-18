# Procedimento Operacional: Rotação de API Keys sem Downtime

**Produto:** OEST / DroneHub & Avalia Solar  
**Camada:** MCP Platform ↔ Rails Canonical Backend  
**Tipo de Credencial:** `Enterprises::ApiKey` (Bearer Token `dh_live_...`)  

---

## 1. Visão Geral e Princípios

A rotação de chaves de API é essencial para manter a segurança do ambiente corporativo sem interromper as operações contínuas dos agentes de IA e clientes MCP.

### Princípios Fundamentais:
1. **Zero Downtime:** A organização deve manter simultaneamente duas chaves válidas (Overlap Window) durante a transição.
2. **Atomicidade no Host MCP:** A atualização da variável de ambiente `OEST_MCP_API_KEY` ocorre por reinício do processo ou atualização de segredo no cofre (AWS Secrets Manager / Vault / `.env`).
3. **Auditoria e Revogação Segura:** A chave antiga só deve ser revogada após confirmação de que o tráfego foi 100% migrado para a nova chave.

---

## 2. Fluxo Passo a Passo de Rotação

```
  +-------------------------------------------------------------------------------+
  |                              FASE 1: OVERLAP                                  |
  |  Rails DB: [Chave A (Ativa)] + [Chave B (Criada)]                             |
  +-------------------------------------------------------------------------------+
                                         |
                                         v
  +-------------------------------------------------------------------------------+
  |                              FASE 2: TRANSIÇÃO                                |
  |  Host MCP / AI Client atualiza: OEST_MCP_API_KEY = Chave B                     |
  |  Processo MCP é reiniciado com Chave B                                         |
  +-------------------------------------------------------------------------------+
                                         |
                                         v
  +-------------------------------------------------------------------------------+
  |                              FASE 3: VALIDAÇÃO                                |
  |  Verificar logs do Rails / MCP confirmando requests autenticados com Chave B  |
  +-------------------------------------------------------------------------------+
                                         |
                                         v
  +-------------------------------------------------------------------------------+
  |                              FASE 4: REVOGAÇÃO                                |
  |  Rails Admin / API: Revoga Chave A (revoked_at = Time.current)                |
  +-------------------------------------------------------------------------------+
```

---

## 3. Instruções Detalhadas por Etapa

### Etapa 1 — Criação da Nova Chave no Rails
No console do Rails ou painel administrativo do tenant:
```ruby
# Gerar nova chave DEV/PROD para a organização
new_key = current_organization.api_keys.create!(
  name: "MCP Operational Key (Rotated #{Time.current.strftime('%Y-%m-%d')})",
  scopes: ["missions:read", "missions:write", "orders:read", "orders:write"],
  expires_at: 90.days.from_now
)

puts "NOVA API KEY GERADA: #{new_key.raw_key}"
```

### Etapa 2 — Atualização no Cliente MCP
Atualize a configuração do MCP host:
- **No arquivo de configuração do Claude Desktop / Host:**
```json
{
  "mcpServers": {
    "oest": {
      "command": "npx",
      "args": ["@mcp-platform/oest-mcp"],
      "env": {
        "OEST_API_URL": "https://api.dronehub.com.br",
        "OEST_MCP_API_KEY": "<NOVA_API_KEY_AQUI>"
      }
    }
  }
}
```

### Etapa 3 — Validação de Saúde
Execute uma chamada de validação (ex: `get_system_health` ou `get_platform_info`) para confirmar que a nova chave está ativa e funcional.

### Etapa 4 — Revogação da Chave Antiga
Após certificar-se de que não há mais tráfego utilizando a chave anterior:
```ruby
old_key = current_organization.api_keys.find_by(id: "<ID_CHAVE_ANTIGA>")
old_key.update!(revoked_at: Time.current)
```

---

## 4. Plano de Contingência e Rollback

Se a nova chave falhar ou apresentar problemas de permissão:
1. Restaure imediatamente o valor de `OEST_MCP_API_KEY` com a chave antiga no host.
2. Como a chave antiga **não foi revogada** antes da validação, o tráfego volta a funcionar instantaneamente.
3. Investigue o escopo e permissões da nova chave antes de tentar nova rotação.
