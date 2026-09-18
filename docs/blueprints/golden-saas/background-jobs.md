# Golden SaaS Blueprint — Background Jobs & Asynchronous Workflows

## 1. Overview & Conceptual Architecture

O subsistema de **Jobs em Segundo Plano & Filas Assíncronas** processa tarefas pesadas (processamento de imagens, emissão de relatórios, envio de emails, sincronização de webhooks e faturamento) sem bloquear o ciclo HTTP.

- **Reference Implementation (LastSaaS):** Inngest / Trigger.dev / BullMQ / Serverless functions.
- **Golden Stack Adaptation:** Rails 8 + ActiveJob + Sidekiq Pro/Enterprise + Redis Sentinel/Cluster + Dead Letter Queue (DLQ) + Sidekiq Cron.

---

## 2. Queue Configuration & Priorities

```yaml
# config/sidekiq.yml
:concurrency: 10
:queues:
  - [critical, 5]
  - [default, 3]
  - [mailers, 2]
  - [low_priority, 1]
```

---

## 3. Standard SaaS Job Structure with Retry & Idempotency

```ruby
# app/jobs/application_job.rb
class ApplicationJob < ActiveJob::Base
  retry_on StandardError, wait: :exponentially_longer, attempts: 5
  discard_on ActiveJob::DeserializationError

  before_perform do |job|
    # Contextualize Current organization and user for multitenant audit
    if job.arguments.first.is_a?(Hash) && job.arguments.first[:organization_id]
      Current.organization = Organization.find_by(id: job.arguments.first[:organization_id])
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/jobs/application_job_spec.rb`: Teste de retentativas exponenciais e isolamento de contexto do tenant.
