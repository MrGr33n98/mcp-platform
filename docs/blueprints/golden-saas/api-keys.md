# Golden SaaS Blueprint — API Keys & M2M Authentication

## 1. Overview & Conceptual Architecture

O subsistema de **Chaves de API & Autenticação M2M** permite a integração segura de agentes, CLI, pipelines de CI/CD e clientes externos aos endpoints corporativos do SaaS.

- **Reference Implementation (LastSaaS):** Next.js route handlers com verificação de Bearer token criptografado.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`ApiKey`) com hashing SHA-256 (`key_digest`), prefixos identificáveis (`oest_live_`, `avalia_dev_`), escopos granulares (`scopes[]`), rotação sem downtime e soft-revocation.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "api_keys", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true
  t.string "name", null: false
  t.string "key_prefix", null: false # primeiros 8 chars para identificação
  t.string "key_digest", null: false, index: { unique: true } # SHA-256 do secret completo
  t.text "scopes", default: [], array: true, null: false
  t.datetime "last_used_at"
  t.datetime "expires_at"
  t.datetime "revoked_at"
  t.timestamps
end
```

---

## 3. Rails Authentication Middleware / Controller Concern

```ruby
# app/controllers/concerns/api_key_authenticatable.rb
module ApiKeyAuthenticatable
  extend ActiveSupport::Concern

  included do
    before_action :authenticate_with_api_key!
  end

  private

  def authenticate_with_api_key!
    token = request.headers["Authorization"]&.sub(/^Bearer\s+/, "")
    return render_unauthorized("Missing Authorization header") unless token

    digest = Digest::SHA256.hexdigest(token)
    @current_api_key = ApiKey.where(key_digest: digest, revoked_at: nil).where("expires_at IS NULL OR expires_at > ?", Time.current).first

    return render_unauthorized("Invalid or revoked API key") unless @current_api_key

    @current_organization = @current_api_key.organization
    @current_api_key.update_column(:last_used_at, Time.current)
  end

  def require_scope!(required_scope)
    return if @current_api_key.scopes.include?("*") || @current_api_key.scopes.include?(required_scope.to_s)
    render json: { error: "FORBIDDEN_SCOPE", message: "Key lacks required scope #{required_scope}" }, status: :forbidden
  end
end
```

---

## 4. Verification & Test Suite

- `spec/models/api_key_spec.rb`: Teste de geração segura, hashing SHA-256 e detecção de expiração/revogação.
- `spec/requests/api_key_auth_spec.rb`: Teste de isolamento multi-tenant via chave de API.
