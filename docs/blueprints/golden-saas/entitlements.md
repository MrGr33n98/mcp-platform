# Golden SaaS Blueprint — Entitlements & Feature Flags

## 1. Overview & Conceptual Architecture

**Entitlements** definem os privilégios e recursos liberados para um tenant com base em sua assinatura, complementos (add-ons) e overrides manuais por administradores.

- **Reference Implementation (LastSaaS):** Feature flags contextuais baseadas em JWT/Stripe Entitlements.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`Entitlement`, `FeatureGrant`) + Pundit Integration + Redis caching.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "entitlements", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "plan", type: :uuid, null: false, foreign_key: true
  t.string "feature_key", null: false # e.g., "export_csv", "api_access", "max_members"
  t.string "value_type", default: "boolean", null: false # boolean, integer, string
  t.string "value", null: false # "true", "100", "unlimited"
  t.timestamps
  t.index ["plan_id", "feature_key"], unique: true
end

create_table "tenant_feature_overrides", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.string "feature_key", null: false
  t.string "value", null: false
  t.string "reason"
  t.datetime "expires_at"
  t.timestamps
  t.index ["organization_id", "feature_key"], unique: true
end
```

---

## 3. Rails Service Layer: EntitlementChecker

```ruby
# app/services/billing/entitlement_checker.rb
module Billing
  class EntitlementChecker
    def initialize(organization)
      @organization = organization
    end

    def can?(feature_key)
      val = value_for(feature_key)
      val == "true" || (val.to_i > 0)
    end

    def limit_for(feature_key)
      val = value_for(feature_key)
      val == "unlimited" ? Float::INFINITY : val.to_i
    end

    def value_for(feature_key)
      # Check active tenant override first
      override = @organization.tenant_feature_overrides.find_by(feature_key: feature_key)
      return override.value if override && (override.expires_at.nil? || override.expires_at > Time.current)

      # Fallback to current subscription plan
      plan = @organization.current_subscription&.plan
      return "false" unless plan

      entitlement = plan.entitlements.find_by(feature_key: feature_key)
      entitlement&.value || "false"
    end
  end
end
```

---

## 4. Policy Guard Integration (Pundit)

```ruby
# app/policies/application_policy.rb
class ApplicationPolicy
  attr_reader :user, :record, :organization

  def initialize(user, record)
    @user = user
    @record = record
    @organization = user.current_organization
  end

  def require_entitlement!(feature_key)
    checker = Billing::EntitlementChecker.new(@organization)
    raise Pundit::NotAuthorizedError, "Upgrade required for #{feature_key}" unless checker.can?(feature_key)
  end
end
```

---

## 5. Verification & Tests

- `spec/services/billing/entitlement_checker_spec.rb`: Teste de resolução de planos, overrides com expiração e limites numéricos.
- `spec/policies/feature_policy_spec.rb`: Garantia de bloqueio 403 Forbidden para tenants sem entitlement ativo.
