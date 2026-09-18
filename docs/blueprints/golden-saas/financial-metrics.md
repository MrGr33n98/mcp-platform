# Golden SaaS Blueprint — Financial Metrics & Revenue Intelligence

## 1. Overview & Conceptual Architecture

O subsistema de **Métricas Financeiras & Inteligência de Receita** calcula métricas críticas de SaaS em tempo real: MRR (Monthly Recurring Revenue), ARR, Churn Rate, LTV (Lifetime Value), ARPU (Average Revenue Per User) e Net Revenue Retention (NRR).

- **Reference Implementation (LastSaaS):** Stripe Sigma / ChartMogul / Baremetrics integration.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`FinancialSnapshot`) + Daily Aggregate Sidekiq Cron Job + ActiveAdmin Analytics Dashboard.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "financial_snapshots", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.date "snapshot_date", null: false, index: { unique: true }
  t.bigint "mrr_cents", default: 0, null: false
  t.bigint "arr_cents", default: 0, null: false
  t.integer "active_subscriptions_count", default: 0, null: false
  t.integer "new_subscriptions_count", default: 0, null: false
  t.integer "churned_subscriptions_count", default: 0, null: false
  t.bigint "expansion_mrr_cents", default: 0, null: false
  t.bigint "contraction_mrr_cents", default: 0, null: false
  t.timestamps
end
```

---

## 3. Rails Aggregate Worker

```ruby
# app/jobs/financial_metrics_calculator_job.rb
class FinancialMetricsCalculatorJob < ApplicationJob
  queue_as :low_priority

  def perform(date = Date.yesterday)
    mrr = Subscription.active.joins(:price).sum("prices.unit_amount_cents")
    active_count = Subscription.active.count
    # Computar snapshots agregados
    FinancialSnapshot.find_or_initialize_by(snapshot_date: date).update!(
      mrr_cents: mrr,
      arr_cents: mrr * 12,
      active_subscriptions_count: active_count
    )
  end
end
```

---

## 4. Verification & Test Suite

- `spec/jobs/financial_metrics_calculator_job_spec.rb`: Teste de agregação matemática de MRR e churn.
