# Golden SaaS Blueprint — File Storage & Asset Delivery

## 1. Overview & Conceptual Architecture

O subsistema de **Armazenamento de Arquivos & Entrega de Ativos** processa uploads diretos do cliente para o bucket com URLs pré-assinadas (Direct Uploads), garantindo isolamento por tenant e antivírus/validação de MIME type.

- **Reference Implementation (LastSaaS):** Next.js S3 presigned URLs / Uploadthing / Cloudflare R2.
- **Golden Stack Adaptation:** Rails 8 + ActiveStorage + AWS S3 / DigitalOcean Spaces / Cloudflare R2 + Direct Uploads com checksum SHA-256 e quotas por tenant.

---

## 2. Configuration & Direct Uploads

```yaml
# config/storage.yml
amazon:
  service: S3
  access_key_id: <%= ENV['AWS_ACCESS_KEY_ID'] %>
  secret_access_key: <%= ENV['AWS_SECRET_ACCESS_KEY'] %>
  region: <%= ENV['AWS_REGION'] %>
  bucket: <%= ENV['AWS_BUCKET'] %>
```

```ruby
# app/models/mission.rb
class Mission < ApplicationRecord
  belongs_to :organization
  has_many_attached :orthophotos
  has_one_attached :flight_log
end
```

---

## 3. Direct Upload Guard & Quota Enforcer

```ruby
# app/controllers/direct_uploads_controller.rb
class DirectUploadsController < ActiveStorage::DirectUploadsController
  before_action :authenticate_enterprise!
  before_action :enforce_storage_quota!

  private

  def enforce_storage_quota!
    current_storage = current_organization.computed_storage_bytes
    limit = Billing::EntitlementChecker.new(current_organization).limit_for("storage_bytes")
    if current_storage + params[:blob][:byte_size].to_i > limit
      render json: { error: "STORAGE_QUOTA_EXCEEDED" }, status: :payment_required
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/requests/direct_uploads_spec.rb`: Teste de upload com validação de cota e bloqueio de arquivos corrompidos.
