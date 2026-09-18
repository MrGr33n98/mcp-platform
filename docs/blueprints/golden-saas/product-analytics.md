# Golden SaaS Blueprint — Product Analytics & Funnels

## 1. Overview & Conceptual Architecture

O subsistema de **Product Analytics** coleta métricas de engajamento, retenção (DAU/MAU), funis de ativação de onboarding e adoção de novas features de forma anônima e conforme a LGPD/GDPR.

- **Reference Implementation (LastSaaS):** PostHog / Mixpanel client integration.
- **Golden Stack Adaptation:** Rails 8 + Ahoy gem / Custom Analytics Collector + PostHog / PostHog self-hosted + Next.js App Router analytics hook.

---

## 2. Event Ingestion Pipeline

```ruby
# app/services/analytics/event_publisher.rb
module Analytics
  class EventPublisher
    def self.publish(event_name, properties = {}, user: nil, organization: nil)
      payload = {
        event: event_name,
        distinct_id: user&.id || "anonymous",
        properties: properties.merge(
          organization_id: organization&.id,
          environment: Rails.env,
          timestamp: Time.current.iso8601
        )
      }

      PublishAnalyticsEventJob.perform_later(payload)
    end
  end
end
```

---

## 3. Verification & Test Suite

- `spec/services/analytics/event_publisher_spec.rb`: Teste de sanitização de PII e enfileiramento de eventos.
