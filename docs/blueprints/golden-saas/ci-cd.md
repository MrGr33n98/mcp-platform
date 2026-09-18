# Golden SaaS Blueprint — CI/CD Automation & Release Engineering

## 1. Overview & Conceptual Architecture

O subsistema de **Automação de CI/CD** orquestra pipelines automáticas de validação estática (lint, security, typecheck), suíte de testes paralela, compilação de assets/Docker images e deploys contínuos protegidos por branch protection rules.

- **Reference Implementation (LastSaaS):** GitHub Actions + Vercel Preview/Production deployments.
- **Golden Stack Adaptation:** GitHub Actions Matrix (Ruby + Node.js) + Kamal / Docker Compose / Kubernetes + Blue-Green / Zero-Downtime Deployment.

---

## 2. GitHub Actions Pipeline Definition

```yaml
# .github/workflows/ci.yml
name: Golden SaaS CI/CD
on: [push, pull_request]

jobs:
  backend-audit-and-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: password
        ports: ["5432:5432"]
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.3
          bundler-cache: true
      - name: Security scan (Brakeman & Bundle Audit)
        run: |
          bundle exec brakeman -z -q
          bundle exec bundle-audit check --update
      - name: Database setup and tests
        env:
          DATABASE_URL: postgres://postgres:password@localhost:5432/saas_test
          REDIS_URL: redis://localhost:6379/1
        run: |
          bundle exec rails db:create db:schema:load
          bundle exec rspec
```

---

## 3. Release Gates

- Lint / Formatting (RuboCop / ESLint / Prettier).
- Security (Brakeman / npm audit / bundle-audit).
- Test Suites (RSpec / Vitest / Playwright).
- Typecheck (TypeScript `tsc --noEmit`).
