# Golden SaaS Blueprint — API Documentation & OpenAPI

## 1. Overview & Conceptual Architecture

O subsistema de **Documentação de API & OpenAPI** expõe as especificações interativas da API pública para desenvolvedores e parceiros via Swagger / Redoc / Scalar.

- **Reference Implementation (LastSaaS):** Next.js Swagger-UI / Mintlify / OpenAPI JSON.
- **Golden Stack Adaptation:** Rails 8 + Rswag / RapiDoc / OpenAPI 3.1 YAML + Redocly Next.js Embed.

---

## 2. OpenAPI Generation & Contract Testing

```ruby
# spec/requests/api/v1/missions_spec.rb
require "swagger_helper"

RSpec.describe "api/v1/missions", type: :request do
  path "/api/v1/missions" do
    get("List missions") do
      tags "Missions"
      produces "application/json"
      security [bearer_auth: []]

      response(200, "successful") do
        schema type: :object,
          properties: {
            missions: {
              type: :array,
              items: { "$ref" => "#/components/schemas/Mission" }
            }
          }
        run_test!
      end
    end
  end
end
```

---

## 3. Verification & Test Suite

- `spec/requests/api_docs_spec.rb`: Teste de integridade do arquivo `openapi.json` gerado pelo pipeline de build.
