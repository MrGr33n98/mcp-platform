import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, ServicePlan } from "./types.js";

export class ServicePlanner {
  public static planServices(definition: ResolvedCapabilityDefinition, pattern: CodePattern): ServicePlan[] {
    const tenantKey = pattern.models.tenantKey;

    if (definition.id === "webhooks") {
      const dispatchService: ServicePlan = {
        name: "Webhooks::DispatchService",
        className: "Webhooks::DispatchService",
        filePath: "app/services/webhooks/dispatch_service.rb",
        responsibility: "Fan-out domain events to subscribed tenant webhook endpoints and enqueue background delivery.",
        inputs: {
          tenant: "Tenant object (e.g. Organization)",
          event_type: "String (e.g. 'mission.created')",
          payload: "Hash (JSON-serializable event payload)"
        },
        outputs: {
          deliveries: "Array<WebhookDelivery>"
        },
        errorHandling: "Logs errors and returns gracefully to never block the main transactional business thread.",
        codePreview: `# frozen_string_literal: true

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
      endpoints = WebhookEndpoint.active.where(${tenantKey}: @tenant.id).for_event(@event_type)
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
`
      };

      const signerService: ServicePlan = {
        name: "Webhooks::HmacSignerService",
        className: "Webhooks::HmacSignerService",
        filePath: "app/services/webhooks/hmac_signer_service.rb",
        responsibility: "Compute HMAC-SHA256 signature header for outgoing webhook payloads.",
        inputs: {
          secret: "String (Endpoint cryptographic signing secret)",
          timestamp: "Integer (Unix timestamp in seconds)",
          raw_payload: "String (Exact raw JSON body)"
        },
        outputs: {
          signature_header: "String formatted as 't=TIMESTAMP,v1=SIGNATURE'"
        },
        errorHandling: "Strict argument validation; raises ArgumentError if secret or payload is nil.",
        codePreview: `# frozen_string_literal: true

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
`
      };

      const ssrfService: ServicePlan = {
        name: "Webhooks::SsrfValidatorService",
        className: "Webhooks::SsrfValidatorService",
        filePath: "app/services/webhooks/ssrf_validator_service.rb",
        responsibility: "Resolve destination hostnames and block calls to private, link-local, loopback, or cloud metadata IP ranges.",
        inputs: {
          url: "String (Target webhook endpoint URL)"
        },
        outputs: {
          valid_ip: "IPAddr (Public destination IP)"
        },
        errorHandling: "Raises SsrfAttemptError if IP falls into disallowed private subnets or resolution fails.",
        codePreview: `# frozen_string_literal: true

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
`
      };

      return [dispatchService, signerService, ssrfService];
    }

    return definition.services.map((serviceName) => ({
      name: serviceName,
      className: serviceName,
      filePath: `app/services/${serviceName.toLowerCase().replace(/::/g, "/")}.rb`,
      responsibility: `Service implementation for ${serviceName}`,
      inputs: { params: "Hash" },
      outputs: { result: "Boolean" },
      errorHandling: "Standard error rescue",
      codePreview: `# frozen_string_literal: true\n\nclass ${serviceName}\n  def self.call(params)\n    new(params).call\n  end\nend\n`
    }));
  }
}
