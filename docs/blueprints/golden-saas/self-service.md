# Golden SaaS Blueprint — Self-Service & Billing Portal

## 1. Overview & Conceptual Architecture

O subsistema de **Portal de Autoatendimento** permite ao cliente gerenciar sua assinatura, atualizar dados de cartão/PIX, baixar notas fiscais/invoices, adicionar novos assentos e solicitar cancelamento ou upgrade diretamente, sem necessidade de suporte humano.

- **Reference Implementation (LastSaaS):** Stripe Customer Portal redirect / Next.js settings pages.
- **Golden Stack Adaptation:** Rails 8 + Stripe Customer Portal Session Generator + Next.js App Router billing dashboard.

---

## 2. Rails Portal Session Controller

```ruby
# app/controllers/api/v1/billing/portal_sessions_controller.rb
module Api
  module V1
    module Billing
      class PortalSessionsController < BaseController
        before_action :authenticate_enterprise!

        def create
          authorize :billing, :manage?

          session = Stripe::BillingPortal::Session.create({
            customer: current_organization.stripe_customer_id,
            return_url: params[:return_url] || "#{request.base_url}/settings/billing"
          })

          render json: { url: session.url }
        end
      end
    end
  end
end
```

---

## 3. Verification & Test Suite

- `spec/requests/api/v1/billing/portal_sessions_spec.rb`: Teste de geração de sessão segura vinculada estritamente à organização do token autenticado.
