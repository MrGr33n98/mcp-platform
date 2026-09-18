# Golden SaaS Blueprint — Usage-Based Metering

## 1. Overview & Conceptual Architecture

O subsistema de **Mapeamento de Uso & Tarifação** contabiliza eventos de consumo em tempo real para cobrança no final do ciclo ou aplicação de rate limits e throttling por cota.

- **Reference Implementation (LastSaaS):** Stripe Metered Billing / Influx / ClickHouse.
- **Golden Stack Adaptation:** Rails 8 + Redis HyperLogLog / Timescale / PostgreSQL Partitioned Tables + Stripe Usage Records Sync Job.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "usage_records", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.string "metric_name", null: false # "api_requests", "storage_bytes", "ai_tokens"
  t.bigint "quantity", default: 1, null: false
  t.datetime "timestamp", null: false
  t.string "idempotency_key", null: false, index: { unique: true }
  t.jsonb "metadata", default: {}
  t.timestamps
end
```

---

## 3. Rails Metering Service & Background Job

```ruby
# app/services/metering/event_tracker.rb
module Metering
  class EventTracker
    def self.track(organization:, metric_name:, quantity: 1, idempotency_key:, metadata: {})
      # 1. In-memory buffer in Redis for high-throughput
      redis_key = "usage:#{organization.id}:#{metric_name}:#{Time.current.strftime('%Y%m%d')}"
      $redis.incrby(redis_key, quantity)

      # 2. Asynchronous persistence to PostgreSQL
      PersistUsageJob.perform_later(
        organization_id: organization.id,
        metric_name: metric_name,
        quantity: quantity,
        timestamp: Time.current.iso8601,
        idempotency_key: idempotency_key,
        metadata: metadata
      )
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/services/metering/event_tracker_spec.rb`: Teste de agregação e disparo assíncrono do job de persistência.
