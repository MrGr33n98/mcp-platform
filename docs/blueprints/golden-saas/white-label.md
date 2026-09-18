# Golden SaaS Blueprint — White-Label & Custom Domains

## 1. Overview & Conceptual Architecture

O subsistema de **White-Label & Custom Domains** permite que tenants corporativos usem seus próprios domínios (ex: `app.cliente.com`), logotipos, cores personalizadas e certificados SSL/TLS automáticos.

- **Reference Implementation (LastSaaS):** Next.js middleware / Vercel Custom Domains API / Tailwind themes dinâmicos.
- **Golden Stack Adaptation:** Rails 8 + ActiveRecord (`CustomDomain`) + Caddy / Cloudflare SSL for SaaS + Next.js App Router dynamic tenant layout.

---

## 2. Data Model & Schema

```ruby
# db/schema.rb
create_table "custom_domains", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
  t.references "organization", type: :uuid, null: false, foreign_key: true, index: { unique: true }
  t.string "hostname", null: false, index: { unique: true }
  t.string "status", default: "pending_verification", null: false # pending_verification, active, failed
  t.string "verification_token", null: false
  t.datetime "verified_at"
  t.timestamps
end
```

---

## 3. Verification & DNS Validation Flow

```ruby
# app/services/domains/domain_verifier.rb
module Domains
  class DomainVerifier
    def self.verify!(custom_domain)
      # Check CNAME or TXT record for verification token
      txt_records = Resolv::DNS.open do |dns|
        dns.getresources("_saas-verify.#{custom_domain.hostname}", Resolv::DNS::Resource::IN::TXT)
      end

      if txt_records.any? { |r| r.strings.include?(custom_domain.verification_token) }
        custom_domain.update!(status: "active", verified_at: Time.current)
        true
      else
        false
      end
    end
  end
end
```

---

## 4. Verification & Test Suite

- `spec/services/domains/domain_verifier_spec.rb`: Teste de validação DNS e isolamento por organização.
