# MCP Platform V5J — Canary & Health Policy

## 1. Avaliação de Sinais de Saúde e Baseline

O `HealthEvaluator` compara a telemetria operacional com a `CanaryPolicy`:
- **Taxa de Erros HTTP 5xx:** Limite padrão de $1\%$ durante o slice de tráfego.
- **Latência P95:** Limite máximo de $1000\text{ms}$.
- **Contagem de Exceções Críticas:** Monitoramento de logs de aplicação.
- **Tamanho Amostral Mínimo:** Requer no mínimo 50 requisições observadas antes de permitir promoção.

---

## 2. Princípio da Evidência Insuficiente

$$\text{Ausência de Erros Observados} \neq \text{Sistema Saudável}$$

Se a telemetria estiver inacessível, desativada ou com 0 requisições:
- O status é classificado como **`INSUFFICIENT_EVIDENCE`**.
- A promoção automática é **estritamente bloqueada** (`BLOCK_PROMOTION`).
