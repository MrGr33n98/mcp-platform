import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { CodePattern, PolicyPlan } from "./types.js";

export class PolicyPlanner {
  public static planPolicies(definition: ResolvedCapabilityDefinition, pattern: CodePattern): PolicyPlan[] {
    const baseClass = pattern.policies.baseClass || "ApplicationPolicy";
    const scopePattern = pattern.policies.tenancyScopePattern || "scope.where(organization: user.organization)";
    const tenantKey = pattern.models.tenantKey;

    if (definition.id === "webhooks") {
      const webhookPolicy: PolicyPlan = {
        name: "WebhookEndpointPolicy",
        className: "WebhookEndpointPolicy",
        filePath: "app/policies/webhook_endpoint_policy.rb",
        modelName: "WebhookEndpoint",
        actions: [
          { action: "index?", allowedRoles: ["owner", "admin", "developer", "viewer"], ruleDescription: "Authenticated member of the tenant organization" },
          { action: "show?", allowedRoles: ["owner", "admin", "developer", "viewer"], ruleDescription: "Record belongs to user's tenant organization" },
          { action: "create?", allowedRoles: ["owner", "admin", "developer"], ruleDescription: "Tenant admin or developer" },
          { action: "update?", allowedRoles: ["owner", "admin", "developer"], ruleDescription: "Record belongs to tenant and user is admin/developer" },
          { action: "destroy?", allowedRoles: ["owner", "admin"], ruleDescription: "Record belongs to tenant and user is owner/admin" },
          { action: "test_delivery?", allowedRoles: ["owner", "admin", "developer"], ruleDescription: "Record belongs to tenant" },
          { action: "deliveries?", allowedRoles: ["owner", "admin", "developer", "viewer"], ruleDescription: "Record belongs to tenant" }
        ],
        scopeDefinition: `class Scope < ${baseClass}::Scope
    def resolve
      ${scopePattern}
    end
  end`,
        codePreview: `# frozen_string_literal: true

class WebhookEndpointPolicy < ${baseClass}
  def index?
    user.present?
  end

  def show?
    owner_or_tenant_member?
  end

  def create?
    admin_or_developer?
  end

  def update?
    admin_or_developer? && owner_or_tenant_member?
  end

  def destroy?
    admin? && owner_or_tenant_member?
  end

  def test_delivery?
    admin_or_developer? && owner_or_tenant_member?
  end

  def deliveries?
    owner_or_tenant_member?
  end

  class Scope < ${baseClass}::Scope
    def resolve
      ${scopePattern}
    end
  end

  private

  def owner_or_tenant_member?
    return false unless user.present? && record.present?
    record.${tenantKey} == (user.respond_to?(:${tenantKey}) ? user.${tenantKey} : user.organization&.id)
  end

  def admin_or_developer?
    return true if user.is_a?(Enterprise::ApiKey)
    return true if user.respond_to?(:admin?) && user.admin?
    return true if user.respond_to?(:role) && %w[owner admin developer].include?(user.role.to_s)
    false
  end

  def admin?
    return true if user.is_a?(Enterprise::ApiKey)
    return true if user.respond_to?(:admin?) && user.admin?
    return true if user.respond_to?(:role) && %w[owner admin].include?(user.role.to_s)
    false
  end
end
`
      };

      return [webhookPolicy];
    }

    // Generic Policy
    return definition.policies.map((policyName) => ({
      name: policyName,
      className: policyName,
      filePath: `app/policies/${policyName.replace(/Policy$/, "").toLowerCase()}_policy.rb`,
      modelName: policyName.replace(/Policy$/, ""),
      actions: [
        { action: "index?", allowedRoles: ["all_members"], ruleDescription: "Authenticated member" },
        { action: "show?", allowedRoles: ["all_members"], ruleDescription: "Belongs to tenant" },
        { action: "create?", allowedRoles: ["admin"], ruleDescription: "Tenant admin" }
      ],
      scopeDefinition: `class Scope < ${baseClass}::Scope\n    def resolve\n      ${scopePattern}\n    end\n  end`,
      codePreview: `# frozen_string_literal: true\n\nclass ${policyName} < ${baseClass}\n  def index?\n    user.present?\n  end\n\n  class Scope < ${baseClass}::Scope\n    def resolve\n      ${scopePattern}\n    end\n  end\nend\n`
    }));
  }
}
