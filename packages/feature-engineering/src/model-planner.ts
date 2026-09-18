import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, ModelPlan } from "./types.js";

export class ModelPlanner {
  public static planModels(definition: ResolvedCapabilityDefinition, pattern: CodePattern): ModelPlan[] {
    const tenantAssociation = pattern.models.tenancyAssociation;
    const tenantModelName = tenantAssociation.replace("belongs_to :", "").trim();

    if (definition.id === "webhooks") {
      const endpointModel: ModelPlan = {
        name: "WebhookEndpoint",
        className: "WebhookEndpoint",
        filePath: "app/models/webhook_endpoint.rb",
        tableName: "webhook_endpoints",
        belongsToTenancy: tenantAssociation,
        associations: [
          tenantAssociation,
          "has_many :webhook_deliveries, dependent: :destroy",
          "has_many :webhook_attempts, through: :webhook_deliveries"
        ],
        validations: [
          "validates :url, presence: true, format: { with: URI::DEFAULT_PARSER.make_regexp(%w[http https]), message: 'must be a valid HTTP/HTTPS URL' }",
          "validate :validate_url_not_ssrf",
          "validates :encrypted_secret, presence: true"
        ],
        scopes: [
          "scope :active, -> { where(active: true) }",
          "scope :for_event, ->(event_type) { active.where('? = ANY(events) OR events = ?', event_type, '{}') }"
        ],
        encryptedAttributes: ["encrypted_secret"],
        codePreview: `# frozen_string_literal: true

class WebhookEndpoint < ApplicationRecord
  ${tenantAssociation}

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
`
      };

      const deliveryModel: ModelPlan = {
        name: "WebhookDelivery",
        className: "WebhookDelivery",
        filePath: "app/models/webhook_delivery.rb",
        tableName: "webhook_deliveries",
        belongsToTenancy: "belongs_to :webhook_endpoint",
        associations: [
          "belongs_to :webhook_endpoint",
          "has_many :webhook_attempts, dependent: :destroy",
          `has_one :${tenantModelName}, through: :webhook_endpoint`
        ],
        validations: [
          "validates :event_type, presence: true",
          "validates :payload, presence: true",
          "validates :status, inclusion: { in: %w[pending processing success failed] }"
        ],
        scopes: [
          "scope :recent, -> { order(created_at: :desc) }",
          "scope :successful, -> { where(status: 'success') }",
          "scope :failed, -> { where(status: 'failed') }"
        ],
        codePreview: `# frozen_string_literal: true

class WebhookDelivery < ApplicationRecord
  belongs_to :webhook_endpoint
  has_many :webhook_attempts, dependent: :destroy
  has_one :${tenantModelName}, through: :webhook_endpoint

  validates :event_type, presence: true
  validates :payload, presence: true
  validates :status, inclusion: { in: %w[pending processing success failed] }

  scope :recent, -> { order(created_at: :desc) }
  scope :successful, -> { where(status: "success") }
  scope :failed, -> { where(status: "failed") }
end
`
      };

      const attemptModel: ModelPlan = {
        name: "WebhookAttempt",
        className: "WebhookAttempt",
        filePath: "app/models/webhook_attempt.rb",
        tableName: "webhook_attempts",
        belongsToTenancy: "belongs_to :webhook_delivery",
        associations: [
          "belongs_to :webhook_delivery",
          "has_one :webhook_endpoint, through: :webhook_delivery"
        ],
        validations: [
          "validates :duration_ms, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true"
        ],
        scopes: [
          "scope :recent, -> { order(created_at: :desc) }"
        ],
        codePreview: `# frozen_string_literal: true

class WebhookAttempt < ApplicationRecord
  belongs_to :webhook_delivery
  has_one :webhook_endpoint, through: :webhook_delivery

  validates :duration_ms, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :recent, -> { order(created_at: :desc) }
end
`
      };

      return [endpointModel, deliveryModel, attemptModel];
    }

    // Generic model planning
    return definition.models.map((modelName) => ({
      name: modelName,
      className: modelName,
      filePath: `app/models/${modelName.toLowerCase()}.rb`,
      tableName: modelName.toLowerCase() + "s",
      belongsToTenancy: tenantAssociation,
      associations: [tenantAssociation],
      validations: ["validates :name, presence: true"],
      scopes: ["scope :recent, -> { order(created_at: :desc) }"],
      codePreview: `# frozen_string_literal: true

class ${modelName} < ApplicationRecord
  ${tenantAssociation}
  validates :name, presence: true
end
`
    }));
  }
}
