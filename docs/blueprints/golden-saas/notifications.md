# Golden SaaS Blueprint — Notifications & Dispatch Center

## 1. Overview & Conceptual Architecture

O subsistema de **Notificações Multi-Canal** entrega alertas e mensagens para usuários e equipes através de múltiplos canais: In-App (Noticed / WebSocket / Turbo Stream), Email (Postmark / SendGrid), SMS/WhatsApp (Twilio) e Webhooks / Slack.

- **Reference Implementation (LastSaaS):** Novu / Knock / Resend integration.
- **Golden Stack Adaptation:** Rails 8 + Noticed gem + ActionMailer + Sidekiq Deliveries + Next.js App Router notification bell dropdown.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "notifications", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "recipient", polymorphic: true, type: :uuid, null: false
  t.string "type", null: false
  t.jsonb "params", default: {}
  t.datetime "read_at"
  t.timestamps
  t.index ["recipient_type", "recipient_id", "read_at"]
end
```

---

## 3. Rails Notification Definition

```ruby
# app/notifications/mission_completed_notification.rb
class MissionCompletedNotification < Noticed::Base
  deliver_by :database
  deliver_by :email, mailer: "MissionMailer", method: :completed_email, if: :email_enabled?

  param :mission

  def message
    "Sua missão #{params[:mission].title} foi concluída com sucesso."
  end

  def url
    mission_path(params[:mission])
  end

  def email_enabled?
    recipient.notification_preferences&.email_notifications?
  end
end
```

---

## 4. Verification & Test Suite

- `spec/notifications/mission_completed_notification_spec.rb`: Teste de entrega multi-canal e respeito às preferências do usuário.
