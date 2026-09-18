# Configuração do Engineering MCP Server no Codex / Claude Desktop

Este documento descreve como registrar e executar o servidor **Engineering MCP** (`@mcp-platform/engineering-mcp`) localmente em clientes MCP compatíveis (como OpenAI Codex, Claude Desktop, Antigravity e IDEs baseadas em MCP).

---

## 1. Configuração do Servidor Local

| Campo | Valor |
| :--- | :--- |
| **Nome** | `mcp-engineering` |
| **Tipo de Transporte** | `STDIO` |
| **Comando Executável** | `C:\Program Files\nodejs\node.exe` |
| **Argumentos** | `C:\Users\Bobi\Desktop\mcp-platform\apps\engineering-mcp\dist\index.js` |
| **Diretório de Trabalho (CWD)** | `C:\Users\Bobi\Desktop\mcp-platform` |

---

## 2. Configuração JSON (Exemplo: `claude_desktop_config.json` ou Codex Config)

Adicione a entrada abaixo no bloco `mcpServers` do seu arquivo de configuração:

```json
{
  "mcpServers": {
    "mcp-engineering": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\Bobi\\Desktop\\mcp-platform\\apps\\engineering-mcp\\dist\\index.js"
      ],
      "cwd": "C:\\Users\\Bobi\\Desktop\\mcp-platform",
      "env": {
        "MCP_PRODUCT_ID": "engineering",
        "MCP_PRODUCT_NAME": "Engineering Platform",
        "MCP_LOG_LEVEL": "info",
        "MCP_VERSION": "0.1.0"
      }
    }
  }
}
```

---

## 3. Variáveis de Ambiente Suportadas

> [!NOTE]
> O Engineering MCP foi projetado com isolamento de segurança e **não requer credenciais de produção no ambiente local** para operações de inspeção, verificação, planejamento de arquitetura e análise de gaps.

| Variável | Obrigatória | Padrão | Descrição |
| :--- | :---: | :---: | :--- |
| `MCP_PRODUCT_ID` | Não | `engineering` | Identificador do produto para auditoria e logs. |
| `MCP_PRODUCT_NAME` | Não | `Engineering Platform` | Nome legível do produto. |
| `MCP_LOG_LEVEL` | Não | `info` | Nível de log (`debug`, `info`, `warn`, `error`). Os logs são sempre enviados para STDERR. |
| `MCP_VERSION` | Não | `0.1.0` | Versão do servidor MCP exposta na inicialização. |

---

## 4. Instruções de Build e Inicialização

Para compilar o servidor antes da execução:

```powershell
# Na raiz do repositório
npm run build --workspace=@mcp-platform/engineering-mcp
```

Para executar em modo de desenvolvimento (com recarregamento):
```powershell
npm run dev:engineering
```

Para executar o servidor compilado em modo produção:
```powershell
npm run start:engineering
```

---

## 5. Ferramentas Disponíveis

Ao inicializar, o servidor expõe 19 ferramentas distribuídas pelas seguintes categorias:
1. **Discovery**: `engineering_get_platform_info`, `engineering_list_capabilities`
2. **Repository Intelligence**: `engineering_scan_repository`, `engineering_get_repository_evidence`
3. **Architecture**: `engineering_build_architecture_graph`
4. **Gap Analysis**: `engineering_analyze_saas_gaps`
5. **Feature Engineering**: `engineering_plan_feature`
6. **Verification**: `engineering_analyze_blast_radius`, `engineering_verify_change`
7. **Controlled Apply**: `engineering_preview_apply`, `engineering_apply_change`, `engineering_rollback_apply`
8. **Git Governance**: `engineering_git_status`, `engineering_prepare_branch`, `engineering_prepare_commit`
9. **Production Diagnostics**: `engineering_diagnose_production`
10. **Safe Release**: `engineering_release_plan`, `engineering_verify_release`, `engineering_rollback_release`
