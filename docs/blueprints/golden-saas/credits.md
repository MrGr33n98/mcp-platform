# Golden SaaS Blueprint — Credits & Prepaid Balance

## 1. Overview & Conceptual Architecture

O sistema de **Créditos e Saldo Pré-Pago** gerencia saldos adquiridos ou provisionados periodicamente para consumo de operações (ex: tokens de IA, chamadas de API, processamento geoespacial).

- **Reference Implementation (LastSaaS):** Wallet pré-paga em Postgres / Stripe Credit top-ups.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`CreditLedger`, `CreditTransaction`) com trava pessimista (`with_lock`) e idempotência estrita.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "credit_ledgers", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true, index: { unique: true }
  t.bigint "balance", default: 0, null: false
  t.timestamps
end

create_table "credit_transactions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "credit_ledger", type: :uuid, null: false, foreign_key: true
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.bigint "amount", null: false # Positivo = crédito, Negativo = débito
  t.string "action", null: false # "subscription_grant", "top_up", "ai_usage", "manual_adjustment"
  t.string "idempotency_key", null: false, index: { unique: true }
  t.jsonb "metadata", default: {}
  t.timestamps
end
```

---

## 3. Transaction Service: CreditEngine

```ruby
# app/services/billing/credit_engine.rb
module Billing
  class CreditEngine
    class InsufficientCreditsError < StandardError; end

    def self.deduct!(organization:, amount:, action:, idempotency_key:, metadata: {})
      raise ArgumentError, "Amount must be positive" if amount <= 0

      # Return early if already processed
      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      return existing if existing

      ledger = organization.credit_ledger || organization.create_credit_ledger!

      ledger.with_lock do
        raise InsufficientCreditsError, "Insufficient credits (balance: #{ledger.balance}, requested: #{amount})" if ledger.balance < amount

        ledger.balance -= amount
        ledger.save!

        CreditTransaction.create!(
          credit_ledger: ledger,
          organization: organization,
          amount: -amount,
          action: action,
          idempotency_key: idempotency_key,
          metadata: metadata
        )
      end
    end

    def self.grant!(organization:, amount:, action:, idempotency_key:, metadata: {})
      raise ArgumentError, "Amount must be positive" if amount <= 0

      existing = CreditTransaction.find_by(idempotency_key: idempotency_key)
      return existing if existing

      ledger = organization.credit_ledger || organization.create_credit_ledger!

      ledger.with_lock do
        ledger.balance += amount
        ledger.save!

        CreditTransaction.create!(
          credit_ledger: ledger,
          organization: organization,
          amount: amount,
          action: action,
          idempotency_key: idempotency_key,
          metadata: metadata
        )
      end
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/services/billing/credit_engine_spec.rb`: Teste de concorrência com threads simultâneas garantindo saldo sem race conditions e deduplicação por chave de idempotência.
