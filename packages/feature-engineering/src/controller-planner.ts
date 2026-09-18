import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, ControllerPlan } from "./types.js";

export class ControllerPlanner {
  public static planControllers(definition: ResolvedCapabilityDefinition, pattern: CodePattern): ControllerPlan[] {
    const apiBaseClass = pattern.controllers.apiBaseClass || "Api::V1::BaseController";
    const authMethod = pattern.controllers.authMethod || "authenticate_api_key!";
    const tenantKey = pattern.models.tenantKey;

    if (definition.id === "webhooks") {
      const webhooksController: ControllerPlan = {
        name: "Api::V1::Developer::WebhooksController",
        className: "Api::V1::Developer::WebhooksController",
        filePath: "app/controllers/api/v1/developer/webhooks_controller.rb",
        baseClass: apiBaseClass,
        actions: [
          { name: "index", httpMethod: "GET", path: "/api/v1/developer/webhooks", policyCheck: "policy_scope(WebhookEndpoint)", description: "List all webhook endpoints for the authenticated tenant" },
          { name: "show", httpMethod: "GET", path: "/api/v1/developer/webhooks/:id", policyCheck: "authorize @endpoint", description: "Retrieve single webhook endpoint details" },
          { name: "create", httpMethod: "POST", path: "/api/v1/developer/webhooks", policyCheck: "authorize WebhookEndpoint", description: "Register a new webhook subscription" },
          { name: "update", httpMethod: "PATCH", path: "/api/v1/developer/webhooks/:id", policyCheck: "authorize @endpoint", description: "Update subscribed event types or destination URL" },
          { name: "destroy", httpMethod: "DELETE", path: "/api/v1/developer/webhooks/:id", policyCheck: "authorize @endpoint", description: "Delete a webhook endpoint subscription" },
          { name: "test_delivery", httpMethod: "POST", path: "/api/v1/developer/webhooks/:id/test", policyCheck: "authorize @endpoint", description: "Dispatch an immediate test event ping to verify connectivity" },
          { name: "deliveries", httpMethod: "GET", path: "/api/v1/developer/webhooks/:id/deliveries", policyCheck: "authorize @endpoint", description: "List historical delivery attempts and HTTP response logs" }
        ],
        codePreview: `# frozen_string_literal: true

module Api
  module V1
    module Developer
      class WebhooksController < ${apiBaseClass}
        before_action :${authMethod}
        before_action :set_endpoint, only: %i[show update destroy test_delivery deliveries]

        # GET /api/v1/developer/webhooks
        def index
          @endpoints = policy_scope(WebhookEndpoint).order(created_at: :desc)
          render json: {
            endpoints: @endpoints.map { |ep| serialize_endpoint(ep) }
          }, status: :ok
        end

        # GET /api/v1/developer/webhooks/:id
        def show
          authorize @endpoint
          render json: { endpoint: serialize_endpoint(@endpoint, include_secret: false) }, status: :ok
        end

        # POST /api/v1/developer/webhooks
        def create
          @endpoint = current_tenant.webhook_endpoints.build(webhook_params)
          authorize @endpoint

          if @endpoint.save
            render json: {
              endpoint: serialize_endpoint(@endpoint, include_secret: true),
              signing_secret: @endpoint.encrypted_secret
            }, status: :created
          else
            render json: { errors: @endpoint.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/developer/webhooks/:id
        def update
          authorize @endpoint

          if @endpoint.update(webhook_params)
            render json: { endpoint: serialize_endpoint(@endpoint) }, status: :ok
          else
            render json: { errors: @endpoint.errors.full_messages }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/developer/webhooks/:id
        def destroy
          authorize @endpoint
          @endpoint.destroy!
          head :no_content
        end

        # POST /api/v1/developer/webhooks/:id/test
        def test_delivery
          authorize @endpoint

          delivery = @endpoint.webhook_deliveries.create!(
            event_type: "ping.test",
            payload: { message: "Test webhook event dispatched from Golden SaaS Platform", timestamp: Time.now.to_i },
            status: "pending"
          )
          Webhooks::DeliverPayloadJob.perform_later(delivery.id)

          render json: {
            message: "Test webhook event queued for delivery",
            delivery_id: delivery.id
          }, status: :accepted
        end

        # GET /api/v1/developer/webhooks/:id/deliveries
        def deliveries
          authorize @endpoint
          @deliveries = @endpoint.webhook_deliveries.recent.limit(50)

          render json: {
            deliveries: @deliveries.map do |del|
              {
                id: del.id,
                event_type: del.event_type,
                status: del.status,
                created_at: del.created_at.iso8601,
                attempts: del.webhook_attempts.recent.map do |att|
                  {
                    response_status: att.response_status,
                    duration_ms: att.duration_ms,
                    error_message: att.error_message,
                    attempted_at: att.created_at.iso8601
                  }
                end
              }
            end
          }, status: :ok
        end

        private

        def set_endpoint
          @endpoint = WebhookEndpoint.find(params[:id])
        end

        def webhook_params
          params.require(:webhook_endpoint).permit(:url, :description, :active, events: [])
        end

        def current_tenant
          if defined?(current_organization) && current_organization
            current_organization
          elsif defined?(current_company) && current_company
            current_company
          elsif defined?(current_account) && current_account
            current_account
          elsif @current_api_key&.organization
            @current_api_key.organization
          else
            raise ActiveRecord::RecordNotFound, "Tenant context not found"
          end
        end

        def serialize_endpoint(endpoint, include_secret: false)
          data = {
            id: endpoint.id,
            ${tenantKey}: endpoint.${tenantKey},
            url: endpoint.url,
            description: endpoint.description,
            events: endpoint.events,
            active: endpoint.active,
            created_at: endpoint.created_at.iso8601,
            updated_at: endpoint.updated_at.iso8601
          }
          data[:signing_secret] = endpoint.encrypted_secret if include_secret
          data
        end
      end
    end
  end
end
`
      };

      return [webhooksController];
    }

    return definition.controllers.map((ctrlName) => ({
      name: ctrlName,
      className: ctrlName,
      filePath: `app/controllers/${ctrlName.toLowerCase().replace(/::/g, "/")}.rb`,
      baseClass: apiBaseClass,
      actions: [
        { name: "index", httpMethod: "GET", path: `/api/v1/${definition.id}`, policyCheck: "policy_scope", description: "List resources" },
        { name: "create", httpMethod: "POST", path: `/api/v1/${definition.id}`, policyCheck: "authorize", description: "Create resource" }
      ],
      codePreview: `# frozen_string_literal: true\n\nclass ${ctrlName} < ${apiBaseClass}\n  before_action :${authMethod}\n  def index\n  end\nend\n`
    }));
  }
}
