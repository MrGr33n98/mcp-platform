import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, TestPlan } from "./types.js";

export class TestPlanner {
  public static planTests(definition: ResolvedCapabilityDefinition, pattern: CodePattern): TestPlan[] {
    const tenantModel = pattern.models.tenancyAssociation.replace("belongs_to :", "").trim();

    if (definition.id === "webhooks") {
      const modelSpec: TestPlan = {
        category: "MODEL_SPEC",
        filePath: "spec/models/webhook_endpoint_spec.rb",
        description: "Validates WebhookEndpoint associations, validations, secret generation, and encryption.",
        testCases: [
          { name: "validates presence of url", assertion: "is invalid without url", protectsAgainst: "Nil URL creation" },
          { name: "validates URL scheme", assertion: "rejects ftp or invalid schemes", protectsAgainst: "Protocol injection" },
          { name: "validates URL SSRF protection", assertion: "rejects 127.0.0.1 and 169.254.169.254", protectsAgainst: "SSRF on localhost / metadata" },
          { name: "generates cryptographic secret on create", assertion: "sets encrypted_secret with 48-char hex string", protectsAgainst: "Missing signing secret" },
          { name: "belongs to tenant", assertion: `belongs to ${tenantModel}`, protectsAgainst: "Orphaned endpoints" }
        ],
        codePreview: `# frozen_string_literal: true

require "rails_helper"

RSpec.describe WebhookEndpoint, type: :model do
  let(:tenant) { create(:${tenantModel}) }
  subject { build(:webhook_endpoint, ${tenantModel}: tenant, url: "https://example.com/webhooks") }

  it { is_expected.to belong_to(:${tenantModel}) }
  it { is_expected.to have_many(:webhook_deliveries).dependent(:destroy) }

  it "generates encrypted_secret before validation on create" do
    endpoint = described_class.create!(
      ${tenantModel}: tenant,
      url: "https://api.external.com/hook"
    )
    expect(endpoint.encrypted_secret).to be_present
    expect(endpoint.encrypted_secret.length).to eq(48)
  end

  it "blocks internal IP ranges via SSRF validation" do
    endpoint = build(:webhook_endpoint, ${tenantModel}: tenant, url: "http://127.0.0.1:3000/webhook")
    expect(endpoint).not_to be_valid
    expect(endpoint.errors[:url]).to include(/unauthorized private network/i)
  end
end
`
      };

      const requestSpec: TestPlan = {
        category: "REQUEST_SPEC",
        filePath: "spec/requests/api/v1/developer/webhooks_spec.rb",
        description: "Integration request tests for webhook management endpoints.",
        testCases: [
          { name: "GET /api/v1/developer/webhooks", assertion: "returns 200 with tenant endpoints", protectsAgainst: "Data leakage" },
          { name: "POST /api/v1/developer/webhooks", assertion: "returns 201 with endpoint and secret once", protectsAgainst: "Creation failure" },
          { name: "DELETE /api/v1/developer/webhooks/:id", assertion: "returns 204 and removes endpoint", protectsAgainst: "Stale subscriptions" }
        ],
        codePreview: `# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Developer::Webhooks", type: :request do
  let(:tenant) { create(:${tenantModel}) }
  let(:api_key) { create(:api_key, ${tenantModel}: tenant) }
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
`
      };

      const crossTenantSpec: TestPlan = {
        category: "CROSS_TENANT_SPEC",
        filePath: "spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb",
        description: "Strict isolation verification between different tenant organizations.",
        testCases: [
          { name: "Tenant A cannot read Tenant B endpoint", assertion: "returns 404 Not Found", protectsAgainst: "Cross-tenant information disclosure" },
          { name: "Tenant A cannot update Tenant B endpoint", assertion: "returns 404 Not Found", protectsAgainst: "Cross-tenant mutation" },
          { name: "Tenant A cannot delete Tenant B endpoint", assertion: "returns 404 Not Found", protectsAgainst: "Cross-tenant deletion" },
          { name: "Tenant A list does not leak Tenant B endpoints", assertion: "returns only Tenant A records", protectsAgainst: "Tenant list poisoning" }
        ],
        codePreview: `# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Webhooks Cross-Tenant Isolation Gate", type: :request do
  let(:tenant_a) { create(:${tenantModel}) }
  let(:tenant_b) { create(:${tenantModel}) }

  let(:api_key_a) { create(:api_key, ${tenantModel}: tenant_a) }
  let(:api_key_b) { create(:api_key, ${tenantModel}: tenant_b) }

  let!(:endpoint_b) { create(:webhook_endpoint, ${tenantModel}: tenant_b, url: "https://tenant-b.com/hook") }

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
`
      };

      const ssrfSpec: TestPlan = {
        category: "SERVICE_SPEC",
        filePath: "spec/services/webhooks/ssrf_validator_service_spec.rb",
        description: "Validates strict SSRF prevention against private IP blocks and cloud metadata addresses.",
        testCases: [
          { name: "allows public HTTPS URL", assertion: "returns true for https://webhook.site", protectsAgainst: "False positive SSRF blocks" },
          { name: "blocks 127.0.0.1", assertion: "raises SsrfAttemptError", protectsAgainst: "Localhost access" },
          { name: "blocks AWS metadata (169.254.169.254)", assertion: "raises SsrfAttemptError", protectsAgainst: "Cloud IAM credential theft" },
          { name: "blocks 10.0.0.0/8 and 192.168.0.0/16", assertion: "raises SsrfAttemptError", protectsAgainst: "Internal network probing" }
        ],
        codePreview: `# frozen_string_literal: true

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
`
      };

      const jobSpec: TestPlan = {
        category: "JOB_SPEC",
        filePath: "spec/jobs/webhooks/deliver_payload_job_spec.rb",
        description: "Validates async HTTP POST, HMAC header generation, and attempt logging.",
        testCases: [
          { name: "successful 200 delivery", assertion: "marks delivery success and records attempt", protectsAgainst: "False failure reports" },
          { name: "500 server error triggers retry", assertion: "marks delivery failed and raises error for ActiveJob retry", protectsAgainst: "Lost webhooks" },
          { name: "10s timeout triggers retry", assertion: "records timeout error and schedules retry", protectsAgainst: "Hung workers" }
        ],
        codePreview: `# frozen_string_literal: true

require "rails_helper"

RSpec.describe Webhooks::DeliverPayloadJob, type: :job do
  let(:tenant) { create(:${tenantModel}) }
  let(:endpoint) { create(:webhook_endpoint, ${tenantModel}: tenant, url: "https://example.com/hook") }
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
`
      };

      return [modelSpec, requestSpec, crossTenantSpec, ssrfSpec, jobSpec];
    }

    return definition.requiredTestCategories.map((cat) => ({
      category: cat,
      filePath: `spec/${cat.toLowerCase().replace(/_spec$/, "")}/${definition.id}_spec.rb`,
      description: `Test suite for ${definition.name} (${cat})`,
      testCases: [
        { name: `validates ${definition.name}`, assertion: "passes assertions", protectsAgainst: "Regressions" }
      ],
      codePreview: `# frozen_string_literal: true\n\nrequire "rails_helper"\n\nRSpec.describe "${definition.name}", type: :${cat.toLowerCase().replace(/_spec$/, "")} do\nend\n`
    }));
  }
}
