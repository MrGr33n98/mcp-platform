# Golden SaaS Blueprint — Security, Hardening & Compliance

## 1. Overview & Conceptual Architecture

O subsistema de **Segurança, Hardening & Conformidade** estabelece defesas em profundidade: Content Security Policy (CSP), CORS restritivo, mitigação de CSRF, proteção contra SQL injection, rate limiting, encriptação em trânsito e repouso (KMS), e conformidade LGPD/GDPR.

- **Reference Implementation (LastSaaS):** Next.js headers / Arcjet / Cloudflare WAF.
- **Golden Stack Adaptation:** Rails 8 + Rack::Attack + SecureHeaders gem + ActiveRecord Encryption (`encrypts :secret`) + Brakeman + Bundler-Audit.

---

## 2. Rate Limiting & Brute Force Defense (Rack::Attack)

```ruby
# config/initializers/rack_attack.rb
class Rack::Attack
  # Rate limit login attempts by IP
  throttle("logins/ip", limit: 5, period: 60.seconds) do |req|
    req.ip if req.path == "/api/v1/auth/sign_in" && req.post?
  end

  # Rate limit API requests per API key
  throttle("api/key", limit: 300, period: 1.minute) do |req|
    req.env["HTTP_AUTHORIZATION"] if req.path.start_with?("/api/v1/enterprise")
  end
end
```

---

## 3. Database Column-Level Encryption

```ruby
# app/models/user.rb
class User < ApplicationRecord
  # Encrypt sensitive PII using Rails 7/8 built-in encryption
  encrypts :tax_id, deterministic: true
  encrypts :phone_number
end
```

---

## 4. Verification & Security Scanning

- `bundle exec brakeman -z -q`: Zero avisos de segurança permitidos na pipeline de CI.
- `bundle exec bundle-audit check --update`: Verificação contínua de CVEs em dependências.
