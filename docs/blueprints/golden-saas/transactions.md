# Golden SaaS Blueprint — Transactions & Invoicing

## 1. Overview & Conceptual Architecture

O subsistema de **Transações & Faturamento** registra o histórico de cobranças, reembolsos, emissão de faturas (PDFs) e reconciliação financeira para auditoria fiscal.

- **Reference Implementation (LastSaaS):** Stripe Invoicing API / Webhooks / Webhooks listener.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`Invoice`, `PaymentTransaction`) + ActiveStorage (PDFs) + Webhook Ingestion.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "invoices", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.string "stripe_invoice_id", index: { unique: true }
  t.integer "amount_due_cents", null: false
  t.integer "amount_paid_cents", default: 0, null: false
  t.string "currency", default: "brl", null: false
  t.string "status", default: "draft", null: false # draft, open, paid, void, uncollectible
  t.string "hosted_invoice_url"
  t.string "invoice_pdf_url"
  t.datetime "period_start"
  t.datetime "period_end"
  t.timestamps
end
```

---

## 3. Webhook Ingestion & Synchronization

```ruby
# app/services/billing/invoice_sync_service.rb
module Billing
  class InvoiceSyncService
    def self.sync_from_stripe(stripe_invoice_obj)
      org = Organization.find_by!(stripe_customer_id: stripe_invoice_obj.customer)

      invoice = org.invoices.find_or_initialize_by(stripe_invoice_id: stripe_invoice_obj.id)
      invoice.assign_attributes(
        amount_due_cents: stripe_invoice_obj.amount_due,
        amount_paid_cents: stripe_invoice_obj.amount_paid,
        currency: stripe_invoice_obj.currency,
        status: stripe_invoice_obj.status,
        hosted_invoice_url: stripe_invoice_obj.hosted_invoice_url,
        invoice_pdf_url: stripe_invoice_obj.invoice_pdf,
        period_start: Time.zone.at(stripe_invoice_obj.period_start),
        period_end: Time.zone.at(stripe_invoice_obj.period_end)
      )
      invoice.save!
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/services/billing/invoice_sync_service_spec.rb`: Teste de sincronização idempotente de faturas emitidas.
