# Golden SaaS Blueprint — Deployment & Infrastructure Architecture

## 1. Overview & Conceptual Architecture

O subsistema de **Deploy e Infraestrutura** provê ambientes padronizados (Development, Staging, Production), orquestração conteinerizada via Docker e Kamal, banco de dados gerenciado com replicação e backups automáticos.

- **Reference Implementation (LastSaaS):** Vercel + Supabase / Neon / AWS RDS.
- **Golden Stack Adaptation:** Docker multi-stage + Kamal 2.0 / AWS ECS / Hetzner Baremetal + PostgreSQL PostGIS + Redis + SSL automático (Let's Encrypt / Caddy).

---

## 2. Production Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM ruby:3.3.0-slim AS base
WORKDIR /rails
RUN apt-get update -qq && apt-get install --no-install-recommends -y \
    build-essential libpq-dev git pkg-config libvips && \
    rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/*

FROM base AS build
COPY Gemfile Gemfile.lock ./
RUN bundle install && rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache

COPY . .
RUN bundle exec bootsnap precompile --gemfile app/ lib/
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile

FROM base AS runner
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

EXPOSE 3000
CMD ["./bin/rails", "server", "-b", "0.0.0.0"]
```

---

## 3. Verification & Health Check

- `GET /health` / `GET /up`: Endpoint padronizado do Rails 8 retornando 200 OK com status de Postgres e Redis.
