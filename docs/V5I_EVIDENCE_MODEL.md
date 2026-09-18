# MCP Platform V5I — Operational Evidence & Hypothesis Model

## 1. Modelo de Evidência Imutável

Nenhuma conclusão de incidente pode existir sem evidência observacional concreta. Toda evidência coletada possui:
- `evidence_id`: Identificador único determinístico.
- `source`: Origem do dado (`log_stream`, `error_tracker`, `metrics_stream`, `postgres`, `sidekiq`).
- `timestamp`: Momento da ocorrência normalizado em ISO-8601.
- `locator`: Serviço e componente afetado (ex: `web/Api::V1::WebhooksController`).
- `sanitized_excerpt`: Trecho textual limpo sem segredos ou PII.
- `fingerprint`: Hash SHA-256 estável da classe de erro e mensagem normalizada.
- `confidence`: Nível numérico de confiança da evidência ($0.0$ a $1.0$).

---

## 2. Motor de Hipóteses e Evidências Contraditórias

O `HypothesisEngine` formula hipóteses de causa-raiz e **ativamente pesquisa por evidências contraditórias** antes de atribuir níveis de confiança (`LOW`, `MEDIUM`, `HIGH`):

### Exemplo: Prevenção de Falsa Causalidade em Deploys
- **Cenário:** Ocorre um deploy às 10:00. Às 10:01, a API externa da Stripe entra em colapso e começa a retornar 503. Às 10:02, a aplicação registra falhas de pagamento.
- **Avaliação do Motor:**
  - Hipótese 1: *Outage de API Externa* $\to$ Confiança **`HIGH`** (apoiada por logs de gateway externos e timeouts).
  - Hipótese 2: *Regressão de Código no Deploy* $\to$ Registra **Evidência Contraditória** (*"Falha concomitante em provedor externo identificada"*) e rebaixa a confiança para **`LOW`**.
  - O motor **não culpa o deploy cegamente** apenas por proximidade temporal.
