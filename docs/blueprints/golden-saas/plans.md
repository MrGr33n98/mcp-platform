# Golden SaaS Blueprint — Plans & Pricing

## 1. Overview & Conceptual Architecture

O subsistema de **Planos & Precificação** define os níveis de serviço, cotas, modelos de cobrança (recorrente, anual, baseado em consumo, freemium) e precificação por assentos (seats) ou recursos.

- **Reference Implementation (LastSaaS):** Next.js / Stripe Pricing Tables / JSON catalog / Webhooks.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`Plan`, `Price`, `Feature`) + Stripe Checkout/Billing + Next.js App Router Pricing UI.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "plans", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.string "name", null: false
  t.string "slug", null: false, index: { unique: true }
  t.text "description"
  t.string "stripe_product_id"
  t.boolean "active", default: true, null: false
  t.integer "sort_order", default: 0, null: false
  t.jsonb "metadata", default: {}
  t.timestamps
end

create_table "prices", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "plan", type: :uuid, null: false, foreign_key: true
  t.string "stripe_price_id", index: { unique: true }
  t.string "currency", default: "brl", null: false
  t.integer "unit_amount_cents", null: false
  t.string "recurring_interval", default: "month", null: false # month, year, one_time
  t.boolean "active", default: true, null: false
  t.timestamps
end
```

---

## 3. Rails Business Logic & Controllers

```ruby
# app/models/plan.rb
class Plan < ApplicationRecord
  has_many :prices, dependent: :destroy
  has_many :entitlements, dependent: :destroy
  has_many :subscriptions

  validates :name, :slug, presence: true
  scope :active, -> { where(active: true).order(:sort_order) }
end

# app/controllers/api/v1/plans_controller.rb
module Api
  module V1
    class PlansController < BaseController
      skip_before_action :authenticate_enterprise!, only: [:index, :show]

      def index
        @plans = Plan.active.includes(:prices, :entitlements)
        render json: @plans.as_json(include: [:prices, :entitlements])
      end

      def show
        @plan = Plan.active.find_by!(slug: params[:id])
        render json: @plan.as_json(include: [:prices, :entitlements])
      end
    end
  end
end
```

---

## 4. Backoffice Management (ActiveAdmin)

```ruby
# app/admin/plans.rb
ActiveAdmin.register Plan do
  permit_params :name, :slug, :description, :stripe_product_id, :active, :sort_order

  index do
    selectable_column
    id_column
    column :name
    column :slug
    column :active
    column :sort_order
    actions
  end
end
```

---

## 5. Next.js Frontend Integration

```tsx
// components/pricing-cards.tsx
import { Plan } from "@/types/billing";

export function PricingCards({ plans }: { plans: Plan[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <div key={plan.id} className="border rounded-xl p-6 bg-card text-card-foreground shadow-sm">
          <h3 className="text-xl font-bold">{plan.name}</h3>
          <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
          {/* Prices and CTA */}
        </div>
      ))}
    </div>
  );
}
```

---

## 6. Verification & Test Suite

- `spec/models/plan_spec.rb`: Validação de slug único, associação com preços e escopo ativo.
- `spec/requests/api/v1/plans_spec.rb`: Retorno público de planos sem expor metadados confidenciais.
