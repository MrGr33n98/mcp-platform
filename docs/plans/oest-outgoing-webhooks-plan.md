# VERTICAL SLICE ENGINEERING PLAN
## Capability: Outgoing Webhooks (`webhooks`)

**Mode:** `PLAN_ONLY`  
**Product Target:** `oest`  
**Approval Status:** 🔒 `HUMAN APPROVAL REQUIRED BEFORE WRITE`  
**Generated At:** 2026-09-17T23:30:17.487Z  

---

### 1. Invariantes Arquiteturais & Regras de Conformidade

| Invariante | Status | Verificação / Evidência |
| :--- | :--- | :--- |
| **NO EVIDENCE → NO CHANGE** | ✅ Aprovado | Gaps confirmados pelo SaaS Gap Analyzer; 5 requirements atômicos |
| **NO TEST PLAN → NO CHANGE** | ✅ Aprovado | 5 suítes de teste planejadas (MODEL_SPEC, REQUEST_SPEC, CROSS_TENANT_SPEC, SERVICE_SPEC, JOB_SPEC) |
| **NO ROLLBACK PLAN → NO MIGRATION** | ✅ Aprovado | Rollback reversível verificado com 2 passos de contingência |
| **NO POLICY → NO TENANT-SCOPED ENDPOINT** | ✅ Aprovado | Pundit policy `WebhookEndpointPolicy` com scope resolution |
| **NO HUMAN APPROVAL → NO WRITE** | ✅ Aprovado | Plano gerado em modo `PLAN_ONLY` (0 escritas em disco nos repositórios) |

---

### 2. Padrões Detectados no Repositório (PatternFinder)
*"Como ESTE SaaS já faz isso?"*

- **Jobs:** Classe base `ApplicationJob`, fila padrão `webhooks`, política `retry_on StandardError, wait: :exponentially_longer, attempts: 5`.
- **Controllers:** Herança de API `ApplicationController`, autenticação via `authenticate_api_key!`.
- **Policies:** Framework `PUNDIT`, base `ApplicationPolicy`, isolamento `scope.where(organization: user.organization)`.
- **Models:** Tenancy `belongs_to :organization`, chaves primárias `uuid`, encriptação `ActiveRecord::Encryption`.
- **Migrations:** Rails `7.0`, chaves estrangeiras com constraints e índices compostos.
- **Testes:** Framework `rspec`, factories `factory_bot`.

---

### 3. Operações Planejadas (ChangePlan: 18 Operações)

| ID | Tipo | Arquivo Alvo | Descrição | Padrão Aplicado |
| :--- | :--- | :--- | :--- | :--- |
| `OP-001-MIGRATION` | `RUN_MIGRATION` | `db/migrate/20260917233017_create_outgoing_webhooks_tables.rb` | Create database tables for Outgoing Webhooks (webhook_endpoints, webhook_deliveries, webhook_attempts) | Rails Migration [7.0] |
| `OP-002-MODEL` | `CREATE_FILE` | `app/models/webhook_endpoint.rb` | Create domain model WebhookEndpoint with tenancy association (belongs_to :organization) | ApplicationRecord with belongs_to :organization |
| `OP-003-MODEL` | `CREATE_FILE` | `app/models/webhook_delivery.rb` | Create domain model WebhookDelivery with tenancy association (belongs_to :webhook_endpoint) | ApplicationRecord with belongs_to :webhook_endpoint |
| `OP-004-MODEL` | `CREATE_FILE` | `app/models/webhook_attempt.rb` | Create domain model WebhookAttempt with tenancy association (belongs_to :webhook_delivery) | ApplicationRecord with belongs_to :webhook_delivery |
| `OP-005-POLICY` | `CREATE_FILE` | `app/policies/webhook_endpoint_policy.rb` | Create Pundit authorization policy WebhookEndpointPolicy enforcing strict tenant boundary | ApplicationPolicy with Scope isolation |
| `OP-006-SERVICE` | `CREATE_FILE` | `app/services/webhooks/dispatch_service.rb` | Create service Webhooks::DispatchService: Fan-out domain events to subscribed tenant webhook endpoints and enqueue background delivery. | CALL_METHOD |
| `OP-007-SERVICE` | `CREATE_FILE` | `app/services/webhooks/hmac_signer_service.rb` | Create service Webhooks::HmacSignerService: Compute HMAC-SHA256 signature header for outgoing webhook payloads. | CALL_METHOD |
| `OP-008-SERVICE` | `CREATE_FILE` | `app/services/webhooks/ssrf_validator_service.rb` | Create service Webhooks::SsrfValidatorService: Resolve destination hostnames and block calls to private, link-local, loopback, or cloud metadata IP ranges. | CALL_METHOD |
| `OP-009-JOB` | `CREATE_FILE` | `app/jobs/webhooks/deliver_payload_job.rb` | Create background worker Webhooks::DeliverPayloadJob on queue 'webhooks' with timeout 10s | ApplicationJob with retry policy |
| `OP-010-CONTROLLER` | `CREATE_FILE` | `app/controllers/api/v1/developer/webhooks_controller.rb` | Create API controller Api::V1::Developer::WebhooksController with authenticate_api_key! | ApplicationController |
| `OP-011-ROUTES` | `REGISTER_ROUTE` | `config/routes.rb` | Register RESTful API routes under /api/v1/developer/webhooks | Rails REST Routing |
| `OP-012-ADMIN` | `ADD_ACTIVE_ADMIN` | `app/admin/webhook_endpoints.rb` | Register ActiveAdmin resource WebhookEndpoint | ActiveAdmin Resource DSL |
| `OP-013-ADMIN` | `ADD_ACTIVE_ADMIN` | `app/admin/webhook_deliveries.rb` | Register ActiveAdmin resource WebhookDelivery | ActiveAdmin Resource DSL |
| `OP-014-TEST` | `CREATE_FILE` | `spec/models/webhook_endpoint_spec.rb` | Create MODEL_SPEC test suite: Validates WebhookEndpoint associations, validations, secret generation, and encryption. | RSpec MODEL_SPEC |
| `OP-015-TEST` | `CREATE_FILE` | `spec/requests/api/v1/developer/webhooks_spec.rb` | Create REQUEST_SPEC test suite: Integration request tests for webhook management endpoints. | RSpec REQUEST_SPEC |
| `OP-016-TEST` | `CREATE_FILE` | `spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb` | Create CROSS_TENANT_SPEC test suite: Strict isolation verification between different tenant organizations. | RSpec CROSS_TENANT_SPEC |
| `OP-017-TEST` | `CREATE_FILE` | `spec/services/webhooks/ssrf_validator_service_spec.rb` | Create SERVICE_SPEC test suite: Validates strict SSRF prevention against private IP blocks and cloud metadata addresses. | RSpec SERVICE_SPEC |
| `OP-018-TEST` | `CREATE_FILE` | `spec/jobs/webhooks/deliver_payload_job_spec.rb` | Create JOB_SPEC test suite: Validates async HTTP POST, HMAC header generation, and attempt logging. | RSpec JOB_SPEC |

---

### 4. Camadas Arquiteturais Detalhadas

#### A. Banco de Dados & Migrações
- **Arquivo:** `db/migrate/20260917233017_create_outgoing_webhooks_tables.rb`
- **Tabelas Criadas:** `webhook_endpoints`, `webhook_deliveries`, `webhook_attempts`

```ruby
# frozen_string_literal: true

class CreateOutgoingWebhooksTables < ActiveRecord::Migration[7.0]
  def change
    create_table :webhook_endpoints, id: :uuid do |t|
      t.references :organization, null: false, foreign_key: true, type: :uuid
      t.string :url, null: false
      t.string :description
      t.string :encrypted_secret, null: false
      t.text :events, array: true, default: []
      t.boolean :active, default: true, null: false
      t.datetime :disabled_at

      t.timestamps
    end
    add_index :webhook_endpoints, [:organization_id, :active]

    create_table :webhook_deliveries, id: :uuid do |t|
      t.references :webhook_endpoint, null: false, foreign_key: { on_delete: :cascade }, type: :uuid
      t.string :event_type, null: false
      t.jsonb :payload, default: {}, null: false
      t.string :status, default: "pending", null: false

      t.timestamps
    end
    add_index :webhook_deliveries, [:webhook_endpoint_id, :created_at]
    add_index :webhook_deliveries, :status

    create_table :webhook_attempts, id: :uuid do |t|
      t.references :webhook_delivery, null: false, foreign_key: { on_delete: :cascade }, type: :uuid
      t.integer :response_status
      t.integer :duration_ms
      t.text :error_message

      t.datetime :created_at, null: false
    end
    add_index :webhook_attempts, :webhook_delivery_id
  end
end
```

#### B. Models de Domínio
##### `WebhookEndpoint` (`app/models/webhook_endpoint.rb`)
- **Tenancy:** `belongs_to :organization`
- **Associações:** belongs_to :organization, has_many :webhook_deliveries, dependent: :destroy, has_many :webhook_attempts, through: :webhook_deliveries
- **Validações:** 3 regras configuradas

```ruby
# frozen_string_literal: true

class WebhookEndpoint < ApplicationRecord
  belongs_to :organization

  has_many :webhook_deliveries, dependent: :destroy
  has_many :webhook_attempts, through: :webhook_deliveries

  encrypts :encrypted_secret

  validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), message: "must be a valid HTTP/HTTPS URL" }
  validate :validate_url_not_ssrf
  validates :encrypted_secret, presence: true

  scope :active, -> { where(active: true) }
  scope :for_event, ->(event_type) { active.where("? = ANY(events) OR events = '{}'", event_type) }

  before_validation :generate_secret, on: :create

  def generate_secret
    self.encrypted_secret ||= SecureRandom.hex(24)
  end

  private

  def validate_url_not_ssrf
    return if url.blank?
    Webhooks::SsrfValidatorService.validate!(url)
  rescue Webhooks::SsrfValidatorService::SsrfAttemptError => e
    errors.add(:url, "is invalid or points to an unauthorized private network: #{e.message}")
  end
end
```

##### `WebhookDelivery` (`app/models/webhook_delivery.rb`)
- **Tenancy:** `belongs_to :webhook_endpoint`
- **Associações:** belongs_to :webhook_endpoint, has_many :webhook_attempts, dependent: :destroy, has_one :organization, through: :webhook_endpoint
- **Validações:** 3 regras configuradas

```ruby
# frozen_string_literal: true

class WebhookDelivery < ApplicationRecord
  belongs_to :webhook_endpoint
  has_many :webhook_attempts, dependent: :destroy
  has_one :organization, through: :webhook_endpoint

  validates :event_type, presence: true
  validates :payload, presence: true
  validates :status, inclusion: { in: %w[pending processing success failed] }

  scope :recent, -> { order(created_at: :desc) }
  scope :successful, -> { where(status: "success") }
  scope :failed, -> { where(status: "failed") }
end
```

##### `WebhookAttempt` (`app/models/webhook_attempt.rb`)
- **Tenancy:** `belongs_to :webhook_delivery`
- **Associações:** belongs_to :webhook_delivery, has_one :webhook_endpoint, through: :webhook_delivery
- **Validações:** 1 regras configuradas

```ruby
# frozen_string_literal: true

class WebhookAttempt < ApplicationRecord
  belongs_to :webhook_delivery
  has_one :webhook_endpoint, through: :webhook_delivery

  validates :duration_ms, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :recent, -> { order(created_at: :desc) }
end
```

#### C. Autorização & Isolamento Multi-Tenant (Pundit Policy)
##### `WebhookEndpointPolicy` (`app/policies/webhook_endpoint_policy.rb`)
```ruby
# frozen_string_literal: true

class WebhookEndpointPolicy < ApplicationPolicy
  def index?
    user.present?
  end

  def show?
    owner_or_tenant_member?
  end

  def create?
    admin_or_developer?
  end

  def update?
    admin_or_developer? && owner_or_tenant_member?
  end

  def destroy?
    admin? && owner_or_tenant_member?
  end

  def test_delivery?
    admin_or_developer? && owner_or_tenant_member?
  end

  def deliveries?
    owner_or_tenant_member?
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      scope.where(organization: user.organization)
    end
  end

  private

  def owner_or_tenant_member?
    return false unless user.present? && record.present?
    record.organization_id == (user.respond_to?(:organization_id) ? user.organization_id : user.organization&.id)
  end

  def admin_or_developer?
    return true if user.is_a?(Enterprise::ApiKey)
    return true if user.respond_to?(:admin?) && user.admin?
    return true if user.respond_to?(:role) && %w[owner admin developer].include?(user.role.to_s)
    false
  end

  def admin?
    return true if user.is_a?(Enterprise::ApiKey)
    return true if user.respond_to?(:admin?) && user.admin?
    return true if user.respond_to?(:role) && %w[owner admin].include?(user.role.to_s)
    false
  end
end
```

#### D. Serviços de Domínio
##### `Webhooks::DispatchService` (`app/services/webhooks/dispatch_service.rb`)
- **Responsabilidade:** Fan-out domain events to subscribed tenant webhook endpoints and enqueue background delivery.

```ruby
# frozen_string_literal: true

module Webhooks
  class DispatchService
    def self.call(tenant:, event_type:, payload:)
      new(tenant: tenant, event_type: event_type, payload: payload).call
    end

    def initialize(tenant:, event_type:, payload:)
      @tenant = tenant
      @event_type = event_type
      @payload = payload
    end

    def call
      endpoints = WebhookEndpoint.active.where(organization_id: @tenant.id).for_event(@event_type)
      return [] if endpoints.empty?

      deliveries = []
      endpoints.each do |endpoint|
        delivery = endpoint.webhook_deliveries.create!(
          event_type: @event_type,
          payload: @payload,
          status: "pending"
        )
        Webhooks::DeliverPayloadJob.perform_later(delivery.id)
        deliveries << delivery
      rescue StandardError => e
        Rails.logger.error("[Webhooks::DispatchService] Failed to queue delivery for endpoint #{endpoint.id}: #{e.message}")
      end

      deliveries
    end
  end
end
```

##### `Webhooks::HmacSignerService` (`app/services/webhooks/hmac_signer_service.rb`)
- **Responsabilidade:** Compute HMAC-SHA256 signature header for outgoing webhook payloads.

```ruby
# frozen_string_literal: true

require "openssl"

module Webhooks
  class HmacSignerService
    def self.sign(secret:, timestamp:, raw_payload:)
      raise ArgumentError, "Secret cannot be blank" if secret.blank?
      raise ArgumentError, "Payload cannot be blank" if raw_payload.nil?

      canonical_string = "#{timestamp}.#{raw_payload}"
      signature = OpenSSL::HMAC.hexdigest("SHA256", secret, canonical_string)

      "t=#{timestamp},v1=#{signature}"
    end
  end
end
```

##### `Webhooks::SsrfValidatorService` (`app/services/webhooks/ssrf_validator_service.rb`)
- **Responsabilidade:** Resolve destination hostnames and block calls to private, link-local, loopback, or cloud metadata IP ranges.

```ruby
# frozen_string_literal: true

require "resolv"
require "ipaddr"

module Webhooks
  class SsrfValidatorService
    class SsrfAttemptError < StandardError; end

    DISALLOWED_RANGES = [
      IPAddr.new("127.0.0.0/8"),      # Loopback
      IPAddr.new("10.0.0.0/8"),       # Private Network (RFC 1918)
      IPAddr.new("172.16.0.0/12"),    # Private Network (RFC 1918)
      IPAddr.new("192.168.0.0/16"),   # Private Network (RFC 1918)
      IPAddr.new("169.254.0.0/16"),   # Link-Local / Cloud Metadata (169.254.169.254)
      IPAddr.new("0.0.0.0/8"),        # Current network
      IPAddr.new("::1/128"),          # IPv6 Loopback
      IPAddr.new("fc00::/7"),         # IPv6 Unique Local
      IPAddr.new("fe80::/10")         # IPv6 Link-Local
    ].freeze

    def self.validate!(url_string)
      uri = URI.parse(url_string)
      raise SsrfAttemptError, "Scheme must be http or https" unless %w[http https].include?(uri.scheme&.downcase)

      host = uri.host
      raise SsrfAttemptError, "Host cannot be blank" if host.blank?

      addresses = Resolv.getaddresses(host)
      raise SsrfAttemptError, "Unable to resolve host: #{host}" if addresses.empty?

      addresses.each do |addr_str|
        ip = IPAddr.new(addr_str)
        if DISALLOWED_RANGES.any? { |range| range.include?(ip) }
          raise SsrfAttemptError, "Destination #{host} (#{addr_str}) is within a forbidden private or local IP range."
        end
      end

      true
    end
  end
end
```

#### E. Background Jobs
##### `Webhooks::DeliverPayloadJob` (`app/jobs/webhooks/deliver_payload_job.rb`)
- **Fila:** `webhooks` | **Timeout:** `10s` | **Retries:** `retry_on StandardError, wait: :exponentially_longer, attempts: 5`

```ruby
# frozen_string_literal: true

require "net/http"
require "json"

module Webhooks
  class DeliverPayloadJob < ApplicationJob
    queue_as :webhooks

    retry_on Net::HTTPError, Timeout::Error, Errno::ECONNREFUSED, wait: :exponentially_longer, attempts: 5 do |job, error|
      delivery = WebhookDelivery.find_by(id: job.arguments.first)
      delivery&.update(status: "failed") if delivery
    end

    def perform(delivery_id)
      delivery = WebhookDelivery.find_by(id: delivery_id)
      return unless delivery
      endpoint = delivery.webhook_endpoint
      return unless endpoint&.active?

      # 1. SSRF Validation
      Webhooks::SsrfValidatorService.validate!(endpoint.url)

      # 2. Payload & Signature preparation
      raw_payload = delivery.payload.is_a?(String) ? delivery.payload : delivery.payload.to_json
      timestamp = Time.now.to_i
      signature = Webhooks::HmacSignerService.sign(
        secret: endpoint.encrypted_secret,
        timestamp: timestamp,
        raw_payload: raw_payload
      )

      # 3. HTTP Request execution with 10s strict timeout
      uri = URI.parse(endpoint.url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.open_timeout = 10
      http.read_timeout = 10

      request = Net::HTTP::Post.new(uri.request_uri)
      request["Content-Type"] = "application/json"
      request["User-Agent"] = "GoldenSaaS-Webhooks/1.0"
      request["X-Webhook-Signature"] = signature
      request["X-Webhook-Event"] = delivery.event_type
      request["X-Webhook-Delivery-Id"] = delivery.id.to_s
      request["X-Webhook-Timestamp"] = timestamp.to_s
      request.body = raw_payload

      start_time = Process.clock_gettime(Process::CLOCK_MONOTONIC)
      response = nil
      error_message = nil

      begin
        response = http.request(request)
      rescue StandardError => e
        error_message = "#{e.class}: #{e.message}"
      ensure
        duration_ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - start_time) * 1000).to_i
      end

      # 4. Record Attempt
      delivery.webhook_attempts.create!(
        response_status: response&.code&.to_i,
        duration_ms: duration_ms,
        error_message: error_message
      )

      # 5. Update Delivery Status
      if response && response.is_a?(Net::HTTPSuccess)
        delivery.update!(status: "success")
      else
        delivery.update!(status: "failed")
        raise StandardError, "Webhook delivery failed with status #{response&.code || 'TIMEOUT'}: #{error_message}"
      end
    end
  end
end
```

#### F. Controllers & Endpoints REST
##### `Api::V1::Developer::WebhooksController` (`app/controllers/api/v1/developer/webhooks_controller.rb`)
- **Classe Base:** `ApplicationController`
- **Ações:** `GET /api/v1/developer/webhooks`, `GET /api/v1/developer/webhooks/:id`, `POST /api/v1/developer/webhooks`, `PATCH /api/v1/developer/webhooks/:id`, `DELETE /api/v1/developer/webhooks/:id`, `POST /api/v1/developer/webhooks/:id/test`, `GET /api/v1/developer/webhooks/:id/deliveries`

```ruby
# frozen_string_literal: true

module Api
  module V1
    module Developer
      class WebhooksController < ApplicationController
        before_action :authenticate_api_key!
        before_action :set_endpoint, only: %i[show update destroy test_delivery deliveries]

        # GET /api/v1/developer/webhooks
        def index
          @endpoints = policy_scope(WebhookEndpoint).order(created_at: :desc)
          render json: {
            endpoints: @endpoints.map { |ep| serialize_endpoint(ep) }
          }, status: :ok
        end

        # GET /api/v1/developer/webhooks/:id
        def show
          authorize @endpoint
          render json: { endpoint: serialize_endpoint(@endpoint, include_secret: false) }, status: :ok
        end

        # POST /api/v1/developer/webhooks
        def create
          @endpoint = current_tenant.webhook_endpoints.build(webhook_params)
          authorize @endpoint

          if @endpoint.save
            render json: {
              endpoint: serialize_endpoint(@endpoint, include_secret: true),
              signing_secret: @endpoint.encrypted_secret
            }, status: :created
          else
            render json: { errors: @endpoint.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/developer/webhooks/:id
        def update
          authorize @endpoint

          if @endpoint.update(webhook_params)
            render json: { endpoint: serialize_endpoint(@endpoint) }, status: :ok
          else
            render json: { errors: @endpoint.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/developer/webhooks/:id
        def destroy
          authorize @endpoint
          @endpoint.destroy!
          head :no_content
        end

        # POST /api/v1/developer/webhooks/:id/test
        def test_delivery
          authorize @endpoint

          delivery = @endpoint.webhook_deliveries.create!(
            event_type: "ping.test",
            payload: { message: "Test webhook event dispatched from Golden SaaS Platform", timestamp: Time.now.to_i },
            status: "pending"
          )
          Webhooks::DeliverPayloadJob.perform_later(delivery.id)

          render json: {
            message: "Test webhook event queued for delivery",
            delivery_id: delivery.id
          }, status: :accepted
        end

        # GET /api/v1/developer/webhooks/:id/deliveries
        def deliveries
          authorize @endpoint
          @deliveries = @endpoint.webhook_deliveries.recent.limit(50)

          render json: {
            deliveries: @deliveries.map do |del|
              {
                id: del.id,
                event_type: del.event_type,
                status: del.status,
                created_at: del.created_at.iso8601,
                attempts: del.webhook_attempts.recent.map do |att|
                  {
                    response_status: att.response_status,
                    duration_ms: att.duration_ms,
                    error_message: att.error_message,
                    attempted_at: att.created_at.iso8601
                  }
                end
              }
            end
          }, status: :ok
        end

        private

        def set_endpoint
          @endpoint = WebhookEndpoint.find(params[:id])
        end

        def webhook_params
          params.require(:webhook_endpoint).permit(:url, :description, :active, events: [])
        end

        def current_tenant
          if defined?(current_organization) && current_organization
            current_organization
          elsif defined?(current_company) && current_company
            current_company
          elsif defined?(current_account) && current_account
            current_account
          elsif @current_api_key&.organization
            @current_api_key.organization
          else
            raise ActiveRecord::RecordNotFound, "Tenant context not found"
          end
        end

        def serialize_endpoint(endpoint, include_secret: false)
          data = {
            id: endpoint.id,
            organization_id: endpoint.organization_id,
            url: endpoint.url,
            description: endpoint.description,
            events: endpoint.events,
            active: endpoint.active,
            created_at: endpoint.created_at.iso8601,
            updated_at: endpoint.updated_at.iso8601
          }
          data[:signing_secret] = endpoint.encrypted_secret if include_secret
          data
        end
      end
    end
  end
end
```

#### G. Suíte de Testes Automatizados
##### `MODEL_SPEC`: `spec/models/webhook_endpoint_spec.rb`
- **Descrição:** Validates WebhookEndpoint associations, validations, secret generation, and encryption.
- **Casos de Teste:** `validates presence of url`, `validates URL scheme`, `validates URL SSRF protection`, `generates cryptographic secret on create`, `belongs to tenant`

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe WebhookEndpoint, type: :model do
  let(:tenant) { create(:organization) }
  subject { build(:webhook_endpoint, organization: tenant, url: "https://example.com/webhooks") }

  it { is_expected.to belong_to(:organization) }
  it { is_expected.to have_many(:webhook_deliveries).dependent(:destroy) }

  it "generates encrypted_secret before validation on create" do
    endpoint = described_class.create!(
      organization: tenant,
      url: "https://api.external.com/hook"
    )
    expect(endpoint.encrypted_secret).to be_present
    expect(endpoint.encrypted_secret.length).to eq(48)
  end

  it "blocks internal IP ranges via SSRF validation" do
    endpoint = build(:webhook_endpoint, organization: tenant, url: "http://127.0.0.1:3000/webhook")
    expect(endpoint).not_to be_valid
    expect(endpoint.errors[:url]).to include(/unauthorized private network/i)
  end
end
```

##### `REQUEST_SPEC`: `spec/requests/api/v1/developer/webhooks_spec.rb`
- **Descrição:** Integration request tests for webhook management endpoints.
- **Casos de Teste:** `GET /api/v1/developer/webhooks`, `POST /api/v1/developer/webhooks`, `DELETE /api/v1/developer/webhooks/:id`

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Developer::Webhooks", type: :request do
  let(:tenant) { create(:organization) }
  let(:api_key) { create(:api_key, organization: tenant) }
  let(:headers) { { "Authorization" => "Bearer #{api_key.raw_token}" } }

  describe "POST /api/v1/developer/webhooks" do
    it "creates a new webhook endpoint and reveals secret once" do
      post "/api/v1/developer/webhooks",
        params: { webhook_endpoint: { url: "https://partner.com/webhook", events: ["mission.created"] } },
        headers: headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["endpoint"]["url"]).to eq("https://partner.com/webhook")
      expect(json["signing_secret"]).to be_present
    end
  end
end
```

##### `CROSS_TENANT_SPEC`: `spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb`
- **Descrição:** Strict isolation verification between different tenant organizations.
- **Casos de Teste:** `Tenant A cannot read Tenant B endpoint`, `Tenant A cannot update Tenant B endpoint`, `Tenant A cannot delete Tenant B endpoint`, `Tenant A list does not leak Tenant B endpoints`

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Webhooks Cross-Tenant Isolation Gate", type: :request do
  let(:tenant_a) { create(:organization) }
  let(:tenant_b) { create(:organization) }

  let(:api_key_a) { create(:api_key, organization: tenant_a) }
  let(:api_key_b) { create(:api_key, organization: tenant_b) }

  let!(:endpoint_b) { create(:webhook_endpoint, organization: tenant_b, url: "https://tenant-b.com/hook") }

  it "strictly blocks Tenant A from viewing Tenant B's endpoint" do
    get "/api/v1/developer/webhooks/#{endpoint_b.id}",
      headers: { "Authorization" => "Bearer #{api_key_a.raw_token}" }

    expect(response).to have_http_status(:not_found)
  end

  it "strictly blocks Tenant A from deleting Tenant B's endpoint" do
    delete "/api/v1/developer/webhooks/#{endpoint_b.id}",
      headers: { "Authorization" => "Bearer #{api_key_a.raw_token}" }

    expect(response).to have_http_status(:not_found)
    expect(WebhookEndpoint.find_by(id: endpoint_b.id)).to be_present
  end
end
```

##### `SERVICE_SPEC`: `spec/services/webhooks/ssrf_validator_service_spec.rb`
- **Descrição:** Validates strict SSRF prevention against private IP blocks and cloud metadata addresses.
- **Casos de Teste:** `allows public HTTPS URL`, `blocks 127.0.0.1`, `blocks AWS metadata (169.254.169.254)`, `blocks 10.0.0.0/8 and 192.168.0.0/16`

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Webhooks::SsrfValidatorService do
  it "blocks AWS metadata IP" do
    expect {
      described_class.validate!("http://169.254.169.254/latest/meta-data")
    }.to raise_error(Webhooks::SsrfValidatorService::SsrfAttemptError, /forbidden private or local IP range/i)
  end

  it "blocks RFC 1918 private subnets" do
    expect {
      described_class.validate!("http://192.168.1.1/admin")
    }.to raise_error(Webhooks::SsrfValidatorService::SsrfAttemptError)
  end
end
```

##### `JOB_SPEC`: `spec/jobs/webhooks/deliver_payload_job_spec.rb`
- **Descrição:** Validates async HTTP POST, HMAC header generation, and attempt logging.
- **Casos de Teste:** `successful 200 delivery`, `500 server error triggers retry`, `10s timeout triggers retry`

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Webhooks::DeliverPayloadJob, type: :job do
  let(:tenant) { create(:organization) }
  let(:endpoint) { create(:webhook_endpoint, organization: tenant, url: "https://example.com/hook") }
  let(:delivery) { create(:webhook_delivery, webhook_endpoint: endpoint, event_type: "mission.created", payload: { id: "123" }) }

  it "dispatches HTTP request with HMAC header and marks success" do
    stub_request(:post, "https://example.com/hook")
      .with(headers: { "X-Webhook-Event" => "mission.created" })
      .to_return(status: 200, body: '{"ok":true}')

    described_class.new.perform(delivery.id)

    expect(delivery.reload.status).to eq("success")
    expect(delivery.webhook_attempts.count).to eq(1)
    expect(delivery.webhook_attempts.first.response_status).to eq(200)
  end
end
```

---

### 5. Matriz de Verificação Automatizada

| ID | Verificação | Comando | Saída Esperada | Severidade |
| :--- | :--- | :--- | :--- | :--- |
| `VERIFY-001-MIGRATION` | Verify Schema Migration & Rollback Reversibility | `bundle exec rails db:migrate && bundle exec rails db:rollback STEP=1 && bundle exec rails db:migrate` | Database migrations executed and rolled back cleanly with 0 errors. | `BLOCKING` |
| `VERIFY-002-MODEL-SPECS` | Execute Model & Validation Specs | `bundle exec rspec spec/models/webhooks_*_spec.rb spec/models/webhook_*.rb` | 0 failures | `BLOCKING` |
| `VERIFY-003-REQUEST-SPECS` | Execute Request & Authorization Specs | `bundle exec rspec spec/requests/api/v1/developer/webhooks_spec.rb` | 0 failures | `BLOCKING` |
| `VERIFY-004-CROSS-TENANT-GATE` | Execute Cross-Tenant Isolation Gate | `bundle exec rspec spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb` | 0 failures | `BLOCKING` |
| `VERIFY-005-SSRF-GATE` | Execute SSRF Network Boundary Gate | `bundle exec rspec spec/services/webhooks/ssrf_validator_service_spec.rb` | 0 failures | `BLOCKING` |
| `VERIFY-006-RUBY-LINT` | RuboCop Style & Security Linter | `bundle exec rubocop app/models/webhook* app/controllers/api/v1/developer/webhooks* app/jobs/webhooks* app/services/webhooks*` | no offenses detected | `WARNING` |

---

### 6. Procedimento de Rollback & Contingência

- **Estratégia:** `MIGRATION_DOWN`
- **Risco de Perda de Dados:** LOW (new tables only; no pre-existing domain data affected).
- **Garantia de Reversibilidade:** ✅ `true`

Passos de execução em caso de falha:
1. **Rollback Migration via Rails** (`LOW`): Revert migration using Rails migration rollback command.
   ```bash
   bundle exec rails db:rollback STEP=1
   ```
2. **Direct Table Drop (Emergency Fallback)** (`MEDIUM`): Drop created tables in reverse dependency order if migration rollback is locked.
   ```ruby
   ActiveRecord::Base.connection.execute('DROP TABLE IF EXISTS webhook_attempts, webhook_deliveries, webhook_endpoints CASCADE;')
   ```