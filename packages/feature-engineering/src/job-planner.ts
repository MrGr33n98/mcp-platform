import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, JobPlan } from "./types.js";

export class JobPlanner {
  public static planJobs(definition: ResolvedCapabilityDefinition, pattern: CodePattern): JobPlan[] {
    const baseClass = pattern.jobs.baseClass || "ApplicationJob";
    const queueName = pattern.jobs.queueName || "webhooks";

    if (definition.id === "webhooks") {
      const deliverJob: JobPlan = {
        name: "Webhooks::DeliverPayloadJob",
        className: "Webhooks::DeliverPayloadJob",
        filePath: "app/jobs/webhooks/deliver_payload_job.rb",
        queue: queueName,
        retryPolicy: "retry_on StandardError, wait: :exponentially_longer, attempts: 5",
        timeoutSeconds: 10,
        parameters: {
          delivery_id: "UUID / String (WebhookDelivery record ID)"
        },
        codePreview: `# frozen_string_literal: true

require "net/http"
require "json"

module Webhooks
  class DeliverPayloadJob < ${baseClass}
    queue_as :${queueName}

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
`
      };

      return [deliverJob];
    }

    return definition.jobs.map((jobName) => ({
      name: jobName,
      className: jobName,
      filePath: `app/jobs/${jobName.toLowerCase().replace(/::/g, "/")}.rb`,
      queue: queueName,
      retryPolicy: "retry_on StandardError, attempts: 3",
      timeoutSeconds: 30,
      parameters: { id: "String" },
      codePreview: `# frozen_string_literal: true\n\nclass ${jobName} < ${baseClass}\n  queue_as :${queueName}\n  def perform(id)\n  end\nend\n`
    }));
  }
}
