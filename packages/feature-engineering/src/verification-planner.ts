import type { ResolvedCapabilityDefinition } from "./requirement-resolver.js";
import type { SecurityCheckPlan, VerificationPlan } from "./types.js";

export class VerificationPlanner {
  public static planSecurityChecks(definition: ResolvedCapabilityDefinition): SecurityCheckPlan[] {
    const checks: SecurityCheckPlan[] = [
      {
        ruleId: "SEC-001-TENANCY",
        name: "Tenant Data Isolation Boundary",
        category: "TENANCY_ISOLATION",
        mitigationStrategy: "All queries, mutations, and deliveries are scoped strictly via organization_id / tenant_id and protected by Pundit policies.",
        automatedVerification: "bundle exec rspec spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb"
      },
      {
        ruleId: "SEC-002-ENCRYPT",
        name: "AES-256-GCM Secret Storage at Rest",
        category: "SECRET_STORAGE",
        mitigationStrategy: "ActiveRecord::Encryption configured on encrypted_secret; raw secret displayed only once at creation time.",
        automatedVerification: "bundle exec rspec spec/models/webhook_endpoint_spec.rb"
      },
      {
        ruleId: "SEC-003-SSRF",
        name: "SSRF Internal Network Blocking",
        category: "SSRF_PREVENTION",
        mitigationStrategy: "Webhooks::SsrfValidatorService blocks 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.169.254, and IPv6 loopbacks before HTTP dispatch.",
        automatedVerification: "bundle exec rspec spec/services/webhooks/ssrf_validator_service_spec.rb"
      },
      {
        ruleId: "SEC-004-RBAC",
        name: "Role-Based Access Control",
        category: "RBAC_ENFORCEMENT",
        mitigationStrategy: "Only Owner, Admin, and Developer roles can register, update, or test webhook endpoints.",
        automatedVerification: "bundle exec rspec spec/policies/webhook_endpoint_policy_spec.rb"
      }
    ];

    if (!definition.securityRequirements.ssrfProtection) {
      return checks.filter((c) => c.category !== "SSRF_PREVENTION");
    }

    return checks;
  }

  public static planVerification(definition: ResolvedCapabilityDefinition): VerificationPlan {
    return {
      preConditions: [
        "Database is reachable and schema migrations are up to date.",
        "ActiveJob background queue worker (Sidekiq / async) is configured.",
        "ActiveRecord::Encryption keys are configured in credentials.yml.enc."
      ],
      checks: [
        {
          id: "VERIFY-001-MIGRATION",
          name: "Verify Schema Migration & Rollback Reversibility",
          command: "bundle exec rails db:migrate && bundle exec rails db:rollback STEP=1 && bundle exec rails db:migrate",
          expectedOutput: "Database migrations executed and rolled back cleanly with 0 errors.",
          severity: "BLOCKING"
        },
        {
          id: "VERIFY-002-MODEL-SPECS",
          name: "Execute Model & Validation Specs",
          command: `bundle exec rspec spec/models/${definition.id.toLowerCase()}_*_spec.rb spec/models/webhook_*.rb`,
          expectedOutput: "0 failures",
          severity: "BLOCKING"
        },
        {
          id: "VERIFY-003-REQUEST-SPECS",
          name: "Execute Request & Authorization Specs",
          command: "bundle exec rspec spec/requests/api/v1/developer/webhooks_spec.rb",
          expectedOutput: "0 failures",
          severity: "BLOCKING"
        },
        {
          id: "VERIFY-004-CROSS-TENANT-GATE",
          name: "Execute Cross-Tenant Isolation Gate",
          command: "bundle exec rspec spec/requests/api/v1/developer/webhooks_cross_tenant_spec.rb",
          expectedOutput: "0 failures",
          severity: "BLOCKING"
        },
        {
          id: "VERIFY-005-SSRF-GATE",
          name: "Execute SSRF Network Boundary Gate",
          command: "bundle exec rspec spec/services/webhooks/ssrf_validator_service_spec.rb",
          expectedOutput: "0 failures",
          severity: "BLOCKING"
        },
        {
          id: "VERIFY-006-RUBY-LINT",
          name: "RuboCop Style & Security Linter",
          command: "bundle exec rubocop app/models/webhook* app/controllers/api/v1/developer/webhooks* app/jobs/webhooks* app/services/webhooks*",
          expectedOutput: "no offenses detected",
          severity: "WARNING"
        }
      ],
      postConditions: [
        "All 100% of newly added test specs pass cleanly.",
        "Zero regressions in pre-existing test suites.",
        "ActiveAdmin interface successfully lists endpoints and deliveries without N+1 queries."
      ]
    };
  }
}
