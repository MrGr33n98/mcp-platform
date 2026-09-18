# Golden SaaS Blueprint — Activity Logs & Tenant Feeds

## 1. Overview & Conceptual Architecture

O subsistema de **Logs de Atividade do Usuário / Feeds** provê aos usuários finais uma linha do tempo operacional com as ações ocorridas dentro da sua organização (criação de projetos, pedidos finalizados, relatórios emitidos).

- **Reference Implementation (LastSaaS):** Next.js Activity stream feed component.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`Activity`) + Turbo Stream / Server-Sent Events / Next.js SSE client.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "activities", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.references "user", type: :uuid, foreign_key: true
  t.string "trackable_type", null: false
  t.uuid "trackable_id", null: false
  t.string "action", null: false # "created", "updated", "published", "archived"
  t.jsonb "parameters", default: {}
  t.datetime "created_at", null: false
  t.index ["organization_id", "created_at"]
  t.index ["trackable_type", "trackable_id"]
end
```

---

## 3. Rails Concern: Trackable

```ruby
# app/models/concerns/trackable.rb
module Trackable
  extend ActiveSupport::Concern

  included do
    has_many :activities, as: :trackable, dependent: :destroy
  end

  def record_activity!(user:, action:, params: {})
    activities.create!(
      organization: self.organization,
      user: user,
      action: action,
      parameters: params
    )
  end
end
```

---

## 4. Verification & Test Suite

- `spec/models/concerns/trackable_spec.rb`: Teste de criação automática de atividades em eventos de ciclo de vida.
