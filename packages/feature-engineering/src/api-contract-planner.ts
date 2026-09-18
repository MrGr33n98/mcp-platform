import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { APIContractPlan, RoutePlan } from "./types.js";

export class APIContractPlanner {
  public static planRoutes(definition: ResolvedCapabilityDefinition): RoutePlan[] {
    if (definition.id === "webhooks") {
      return [
        {
          method: "GET",
          path: "/api/v1/developer/webhooks",
          controller: "api/v1/developer/webhooks",
          action: "index",
          routeCodeSnippet: "get 'developer/webhooks', to: 'developer/webhooks#index'"
        },
        {
          method: "POST",
          path: "/api/v1/developer/webhooks",
          controller: "api/v1/developer/webhooks",
          action: "create",
          routeCodeSnippet: "post 'developer/webhooks', to: 'developer/webhooks#create'"
        },
        {
          method: "GET",
          path: "/api/v1/developer/webhooks/:id",
          controller: "api/v1/developer/webhooks",
          action: "show",
          routeCodeSnippet: "get 'developer/webhooks/:id', to: 'developer/webhooks#show'"
        },
        {
          method: "PATCH",
          path: "/api/v1/developer/webhooks/:id",
          controller: "api/v1/developer/webhooks",
          action: "update",
          routeCodeSnippet: "patch 'developer/webhooks/:id', to: 'developer/webhooks#update'"
        },
        {
          method: "DELETE",
          path: "/api/v1/developer/webhooks/:id",
          controller: "api/v1/developer/webhooks",
          action: "destroy",
          routeCodeSnippet: "delete 'developer/webhooks/:id', to: 'developer/webhooks#destroy'"
        },
        {
          method: "POST",
          path: "/api/v1/developer/webhooks/:id/test",
          controller: "api/v1/developer/webhooks",
          action: "test_delivery",
          routeCodeSnippet: "post 'developer/webhooks/:id/test', to: 'developer/webhooks#test_delivery'"
        },
        {
          method: "GET",
          path: "/api/v1/developer/webhooks/:id/deliveries",
          controller: "api/v1/developer/webhooks",
          action: "deliveries",
          routeCodeSnippet: "get 'developer/webhooks/:id/deliveries', to: 'developer/webhooks#deliveries'"
        }
      ];
    }

    return definition.routes.map((r) => ({
      method: r.method,
      path: r.path,
      controller: `api/v1/${definition.id}`,
      action: r.action,
      routeCodeSnippet: `${r.method.toLowerCase()} '${r.path.replace(/^\/api\/v1\//, "")}', to: '${definition.id}#${r.action}'`
    }));
  }

  public static planContracts(definition: ResolvedCapabilityDefinition): APIContractPlan[] {
    if (definition.id === "webhooks") {
      return [
        {
          endpoint: "/api/v1/developer/webhooks",
          method: "GET",
          headers: {
            Authorization: "Bearer <API_KEY>",
            Accept: "application/json"
          },
          requestSchema: {},
          responseSchema: {
            endpoints: [
              {
                id: "uuid",
                url: "string (https://...)",
                description: "string | null",
                events: "string[]",
                active: "boolean",
                created_at: "ISO8601",
                updated_at: "ISO8601"
              }
            ]
          },
          statusCodes: [
            { code: 200, description: "Successfully listed webhook endpoints" },
            { code: 401, description: "Missing or invalid API Key" },
            { code: 403, description: "Forbidden - Insufficient permissions" }
          ]
        },
        {
          endpoint: "/api/v1/developer/webhooks",
          method: "POST",
          headers: {
            Authorization: "Bearer <API_KEY>",
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          requestSchema: {
            webhook_endpoint: {
              url: "string (required, HTTPS format)",
              description: "string (optional)",
              events: "string[] (optional, empty means all events)"
            }
          },
          responseSchema: {
            endpoint: {
              id: "uuid",
              url: "string",
              description: "string | null",
              events: "string[]",
              active: "boolean",
              created_at: "ISO8601"
            },
            signing_secret: "string (displayed only once at creation)"
          },
          statusCodes: [
            { code: 201, description: "Webhook endpoint created successfully" },
            { code: 422, description: "Validation error (invalid URL, SSRF detected, or duplicate)" },
            { code: 401, description: "Unauthorized" }
          ]
        },
        {
          endpoint: "/api/v1/developer/webhooks/:id/test",
          method: "POST",
          headers: {
            Authorization: "Bearer <API_KEY>",
            Accept: "application/json"
          },
          requestSchema: {},
          responseSchema: {
            message: "string",
            delivery_id: "uuid"
          },
          statusCodes: [
            { code: 202, description: "Test ping queued for background delivery" },
            { code: 404, description: "Endpoint not found or belongs to another tenant" },
            { code: 401, description: "Unauthorized" }
          ]
        }
      ];
    }

    return [
      {
        endpoint: `/api/v1/${definition.id}`,
        method: "GET",
        headers: { Authorization: "Bearer <TOKEN>" },
        requestSchema: {},
        responseSchema: { data: "array" },
        statusCodes: [{ code: 200, description: "Success" }]
      }
    ];
  }
}
