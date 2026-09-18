import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { ActiveAdminPlan, CodePattern } from "./types.js";

export class ActiveAdminPlanner {
  public static planActiveAdmin(definition: ResolvedCapabilityDefinition, pattern: CodePattern): ActiveAdminPlan[] {
    if (pattern.admin.framework !== "active_admin" && definition.adminResources.length === 0) {
      return [];
    }

    if (definition.id === "webhooks") {
      const endpointAdmin: ActiveAdminPlan = {
        resourceName: "WebhookEndpoint",
        filePath: "app/admin/webhook_endpoints.rb",
        menuPriority: 50,
        permittedParams: ["url", "description", "active", "events"],
        codePreview: `# frozen_string_literal: true

ActiveAdmin.register WebhookEndpoint do
  menu parent: "Developer & Integrations", priority: 50

  permit_params :url, :description, :active, events: []

  filter :organization
  filter :url
  filter :active
  filter :created_at

  index do
    selectable_column
    id_column
    column :organization
    column :url
    column :active
    column :events
    column :created_at
    actions
  end

  show do
    attributes_table do
      row :id
      row :organization
      row :url
      row :description
      row :active
      row :events
      row :created_at
      row :updated_at
    end

    panel "Recent Deliveries" do
      table_for webhook_endpoint.webhook_deliveries.recent.limit(10) do
        column :id
        column :event_type
        column :status
        column :created_at
      end
    end
  end
end
`
      };

      const deliveryAdmin: ActiveAdminPlan = {
        resourceName: "WebhookDelivery",
        filePath: "app/admin/webhook_deliveries.rb",
        menuPriority: 51,
        permittedParams: [],
        codePreview: `# frozen_string_literal: true

ActiveAdmin.register WebhookDelivery do
  menu parent: "Developer & Integrations", priority: 51
  actions :index, :show

  filter :webhook_endpoint
  filter :event_type
  filter :status
  filter :created_at

  index do
    id_column
    column :webhook_endpoint
    column :event_type
    column :status
    column :created_at
    actions
  end

  show do
    attributes_table do
      row :id
      row :webhook_endpoint
      row :event_type
      row :status
      row :payload do |d|
        pre JSON.pretty_generate(d.payload) rescue d.payload.to_s
      end
      row :created_at
    end

    panel "Delivery Attempts" do
      table_for webhook_delivery.webhook_attempts.recent do
        column :id
        column :response_status
        column :duration_ms
        column :error_message
        column :created_at
      end
    end
  end
end
`
      };

      return [endpointAdmin, deliveryAdmin];
    }

    return definition.adminResources.map((res, idx) => ({
      resourceName: res,
      filePath: `app/admin/${res.toLowerCase()}s.rb`,
      menuPriority: 60 + idx,
      permittedParams: ["name"],
      codePreview: `# frozen_string_literal: true\n\nActiveAdmin.register ${res} do\n  menu priority: ${60 + idx}\n  permit_params :name\nend\n`
    }));
  }
}
