# Golden SaaS Blueprint — Testing Strategy & Quality Assurance

## 1. Overview & Conceptual Architecture

A **Estratégia de Testes do Golden SaaS** aplica a pirâmide de testes com automação total: Unit Tests (Models, Services, Policies), Integration / Request Specs (APIs, Webhooks, Multi-tenancy, Auth) e End-to-End Specs (Playwright / System Specs).

- **Reference Implementation (LastSaaS):** Vitest + Playwright + MSW.
- **Golden Stack Adaptation:** Rails 8 + RSpec + FactoryBot + DatabaseCleaner + VCR/WebMock + SimpleCov (meta: >90% coverage) + Next.js Vitest/Playwright.

---

## 2. Test Structure & Guidelines

```
spec/
├── factories/          # FactoryBot definitions
├── models/             # Validations, associations, scopes, methods
├── policies/           # Pundit authorization rules
├── requests/           # API endpoints, response schemas, error codes
├── services/           # Isolated business logic engines
├── jobs/               # Sidekiq / ActiveJob execution & queue tests
├── support/            # Shared contexts, auth helpers, tenancy helpers
└── swagger/            # OpenAPI contract specs (rswag)
```

---

## 3. Multi-Tenant Request Spec Helper

```ruby
# spec/support/multi_tenant_helper.rb
module MultiTenantHelper
  def auth_headers_for(user)
    token = JwtEncoder.encode(user_id: user.id, organization_id: user.current_organization_id)
    { "Authorization" => "Bearer #{token}", "Accept" => "application/json" }
  end

  def api_key_headers_for(api_key_secret)
    { "Authorization" => "Bearer #{api_key_secret}", "Accept" => "application/json" }
  end
end

RSpec.configure do |config|
  config.include MultiTenantHelper, type: :request
end
```

---

## 4. Verification & Coverage Gate

- `bundle exec rspec`: Suíte 100% verde sem flaky tests.
- `bundle exec simplecov`: Validação de cobertura mínima de 90% em models, services e policies.
