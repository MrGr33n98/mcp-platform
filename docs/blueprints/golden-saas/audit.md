# Golden SaaS Blueprint — Security Audit Logs

## 1. Overview & Conceptual Architecture

O subsistema de **Audit Logs de Segurança** grava trilhas imutáveis e auditáveis de todas as operações sensíveis (login, impersonação, criação de chaves de API, alteração de permissões RBAC, exportações de dados e exclusões).

- **Reference Implementation (LastSaaS):** Event streaming / Append-only log table.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`AuditLog`) + Papertrail / Audited gem / Custom imutável com assinatura criptográfica SHA-256 e partição temporal.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "audit_logs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.references "user", type: :uuid, foreign_key: true
  t.string "action", null: false # "auth.login", "api_key.create", "membership.role_update"
  t.string "ip_address"
  t.string "user_agent"
  t.jsonb "changeset", default: {}
  t.jsonb "metadata", default: {}
  t.datetime "created_at", null: false
  t.index ["organization_id", "created_at"]
end
```

---

## 3. Rails Logger Service

```ruby
# app/services/security/audit_logger.rb
module Security
  class AuditLogger
    def self.log!(organization:, user:, action:, request: nil, changeset: {}, metadata: {})
      AuditLog.create!(
        organization: organization,
        user: user,
        action: action,
        ip_address: request&.remote_ip,
        user_agent: request&.user_agent,
        changeset: changeset,
        metadata: metadata,
        created_at: Time.current
      )
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/services/security/audit_logger_spec.rb`: Teste de gravação imutável e preservação de IP/User-Agent.
