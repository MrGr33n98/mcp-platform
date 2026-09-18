import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, FrontendPlan } from "./types.js";

export class FrontendPlanner {
  public static planFrontend(definition: ResolvedCapabilityDefinition, pattern: CodePattern): FrontendPlan[] {
    if (pattern.frontend.framework === "none" && definition.frontendPages.length === 0) {
      return [];
    }

    if (definition.id === "webhooks") {
      const devSettingsPage: FrontendPlan = {
        pagePath: "/settings/developer",
        filePath: "app/(dashboard)/settings/developer/page.tsx",
        description: "Developer settings page allowing tenant administrators to manage API Keys and Outgoing Webhooks.",
        components: [
          {
            name: "WebhookEndpointsList",
            filePath: "components/developer/webhook-endpoints-list.tsx",
            description: "Table listing configured webhook subscriptions, delivery status badge, and action dropdown."
          },
          {
            name: "CreateWebhookModal",
            filePath: "components/developer/create-webhook-modal.tsx",
            description: "Dialog form to register destination URL and select event topics with immediate secret reveal."
          },
          {
            name: "WebhookDeliveriesDrawer",
            filePath: "components/developer/webhook-deliveries-drawer.tsx",
            description: "Side drawer displaying historical delivery attempts, response codes, latency, and error logs."
          }
        ]
      };

      return [devSettingsPage];
    }

    return definition.frontendPages.map((page) => ({
      pagePath: page,
      filePath: `app${page}/page.tsx`,
      description: `Frontend page for ${definition.name}`,
      components: [
        {
          name: `${definition.name.replace(/\s+/g, "")}View`,
          filePath: `components/${definition.id}/view.tsx`,
          description: `Main view component for ${definition.name}`
        }
      ]
    }));
  }
}
