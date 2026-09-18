# Guia de Governança e Human-in-the-Loop (HITL)
## Modo Dry-Run / Preview e Fila de Propostas para Operações Sensíveis

**Plataforma:** MCP Platform  
**Produtos Suportados:** OEST / DroneHub & Avalia Solar  
**Níveis de Risco Aplicáveis:** `write`, `sensitive`, `destructive`  

---

## 1. Visão Geral

Para operações que alteram estado no backend Rails ou realizam mutações sensíveis/destrutivas (como cancelamento de pedidos, publicação de missões ou atualização de contratos), a MCP Platform oferece dois níveis de governança:

1. **Modo Dry-Run / Preview (`dry_run: true`):** Simulação de impacto sem persistência.
2. **Motor de Propostas HITL (`ProposalEngine`):** Criação de propostas de ação com hash criptográfico SHA-256 e TTL para aprovação humana explícita antes da execução.

---

## 2. Modo Dry-Run / Preview

Qualquer ferramenta de mutação suporta o parâmetro booleano opcional `dry_run: true`.

### Exemplo de Uso via IA:
```json
{
  "toolName": "cancel_order",
  "arguments": {
    "id": "ord-982",
    "reason": "Condições meteorológicas adversas",
    "dry_run": true
  }
}
```

### Resposta de Simulação:
```json
{
  "id": "ord-982",
  "status": "cancelled_preview",
  "description": "Condições meteorológicas adversas",
  "dry_run": true
}
```
*Garantia:* Nenhuma requisição HTTP de escrita é enviada ao Rails; a IA e o usuário visualizam o efeito antes da confirmação.

---

## 3. Fluxo de Propostas HITL (Human-in-the-Loop)

```
  +------------------+             +--------------------+             +--------------------+
  |     AI Agent     |             |   ProposalEngine   |             |   Human Operator   |
  +------------------+             +--------------------+             +--------------------+
           |                                 |                                  |
           | 1. propose({ toolName, ... })   |                                  |
           |-------------------------------->|                                  |
           |                                 | 2. Gera prop-UUID + SHA-256 hash |
           | 3. Retorna Proposal ID          |    Status: PENDING               |
           |<--------------------------------|                                  |
           |                                 |                                  |
           |                                 | 4. listPending()                 |
           |                                 |<---------------------------------|
           |                                 | 5. Revisa payload & hash         |
           |                                 |--------------------------------->|
           |                                 |                                  |
           |                                 | 6. approve(prop-UUID, "alice")   |
           |                                 |<---------------------------------|
           |                                 | 7. Status: APPROVED              |
           | 8. Executa Mutação Autorizada   |                                  |
           |-------------------------------->|                                  |
```

### 3.1. Propriedades de Segurança:
- **Hashing SHA-256 Anti-Adulteração:** O payload é serializado e assinado por hash. Se qualquer campo for alterado entre a proposta e a aprovação, a integridade é violada.
- **TTL e Expiração Automática:** Propostas possuem tempo de vida limitado (default 1 hora). Propostas expiradas não podem ser aprovadas.
- **Auditoria Completa:** O log armazena quem propôs (`proposer`), quem aprovou (`approver`), hash do payload e timestamp de execução.
