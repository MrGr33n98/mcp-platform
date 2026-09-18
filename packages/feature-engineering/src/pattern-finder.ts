import type { RepositoryManifest } from "@mcp-platform/repository-intelligence";
import type { ArchitectureGraphData } from "@mcp-platform/architecture-graph";
import type {
  CodePattern,
  JobPattern,
  ServicePattern,
  ControllerPattern,
  PolicyPattern,
  ModelPattern,
  MigrationPattern,
  TestPattern,
  AdminPattern,
  FrontendPattern
} from "./types.js";

export class PatternFinder {
  public static findPatterns(manifest: RepositoryManifest, graph?: ArchitectureGraphData | undefined): CodePattern {
    return {
      jobs: this.findJobPattern(manifest, graph),
      services: this.findServicePattern(manifest, graph),
      controllers: this.findControllerPattern(manifest, graph),
      policies: this.findPolicyPattern(manifest, graph),
      models: this.findModelPattern(manifest, graph),
      migrations: this.findMigrationPattern(manifest, graph),
      tests: this.findTestPattern(manifest, graph),
      admin: this.findAdminPattern(manifest, graph),
      frontend: this.findFrontendPattern(manifest, graph)
    };
  }

  public static findJobPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): JobPattern {
    const jobs = manifest.backend.jobs;
    let baseClass = "ApplicationJob";
    let queueName = "default";
    let retryPolicy = "retry_on StandardError, wait: :exponentially_longer, attempts: 5";
    let errorHandling = "rescue_from StandardError, with: :handle_job_failure";
    let loggingPattern = 'Rails.logger.info("[#{self.class.name}] Processing job: #{arguments.inspect}")';

    if (jobs.length > 0) {
      const hasApplicationJob = jobs.some((j) => j.name.includes("ApplicationJob") || j.file.includes("application_job"));
      if (hasApplicationJob) {
        baseClass = "ApplicationJob";
      }

      const specificJob = jobs.find((j) => !j.name.includes("ApplicationJob"));
      if (specificJob) {
        queueName = "webhooks";
      }
    }

    return {
      baseClass,
      queueName,
      retryPolicy,
      errorHandling,
      loggingPattern
    };
  }

  public static findServicePattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): ServicePattern {
    const services = manifest.backend.services;
    let patternType: "CALL_METHOD" | "RESULT_OBJECT" | "APPLICATION_SERVICE" = "CALL_METHOD";
    let baseClass: string | undefined = undefined;
    let namespaceConvention = "Webhooks";
    const methodSignature = "def self.call(...)";

    if (services.length > 0) {
      const appService = services.find((s) => s.name.includes("ApplicationService") || s.name.includes("BaseService"));
      if (appService) {
        baseClass = appService.name;
        patternType = "APPLICATION_SERVICE";
      }

      const enterpriseService = services.find((s) => s.name.includes("Enterprise::") || s.file.includes("enterprise"));
      if (enterpriseService) {
        namespaceConvention = "Enterprise::Webhooks";
      }
    }

    return {
      patternType,
      baseClass,
      namespaceConvention,
      methodSignature
    };
  }

  public static findControllerPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): ControllerPattern {
    const controllers = manifest.backend.controllers;
    let apiBaseClass = "Api::V1::BaseController";
    let authMethod = "authenticate_api_key!";
    let errorHandling = "rescue_from ActiveRecord::RecordNotFound, with: :render_not_found";
    let paramsConvention = "params.require(:webhook_endpoint).permit(:url, :description, events: [])";
    let responseSerializer = "render json: serializer.new(resource).as_json, status: :ok";

    const apiV1Controllers = controllers.filter((c) => c.file.includes("api/v1") || c.name.includes("Api::V1"));
    if (apiV1Controllers.length > 0) {
      const baseApi = apiV1Controllers.find((c) => c.name.includes("BaseController"));
      if (baseApi) {
        apiBaseClass = baseApi.name;
      }

      // Check auth methods in controllers
      const enterpriseController = controllers.find((c) => c.name.includes("Enterprise") || c.file.includes("enterprise"));
      if (enterpriseController) {
        authMethod = "authenticate_api_key!";
      }
    } else {
      const baseController = controllers.find((c) => c.name === "ApplicationController" || c.file.includes("application_controller"));
      if (baseController) {
        apiBaseClass = "ApplicationController";
      }
    }

    return {
      apiBaseClass,
      authMethod,
      errorHandling,
      paramsConvention,
      responseSerializer
    };
  }

  public static findPolicyPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): PolicyPattern {
    const policies = manifest.backend.policies;
    let framework: "PUNDIT" | "ACTION_POLICY" | "CAN_CAN_CAN" | "CUSTOM" = "PUNDIT";
    let baseClass = "ApplicationPolicy";
    let tenancyScopePattern = "scope.where(organization: user.organization)";

    if (policies.length > 0) {
      framework = "PUNDIT";
      const appPolicy = policies.find((p) => p.name === "ApplicationPolicy" || p.file.includes("application_policy"));
      if (appPolicy) {
        baseClass = "ApplicationPolicy";
      }
    }

    // Determine tenant model for policy scope
    const models = manifest.backend.models;
    if (models.some((m) => m.name === "Company" || m.name === "Account")) {
      tenancyScopePattern = "scope.where(company_id: user.company_id)";
    }

    return {
      framework,
      baseClass,
      tenancyScopePattern
    };
  }

  public static findModelPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): ModelPattern {
    const models = manifest.backend.models;
    const tables = manifest.database?.tables || [];

    let tenancyAssociation = "belongs_to :organization";
    let tenantKey = "organization_id";
    let idType: "uuid" | "bigint" | "integer" = "uuid";
    let encryptionHelper: "ActiveRecord::Encryption" | "attr_encrypted" | "none" = "ActiveRecord::Encryption";
    const timestamps = true;

    if (models.some((m) => m.name === "Organization")) {
      tenancyAssociation = "belongs_to :organization";
      tenantKey = "organization_id";
    } else if (models.some((m) => m.name === "Company")) {
      tenancyAssociation = "belongs_to :company";
      tenantKey = "company_id";
    } else if (models.some((m) => m.name === "Account")) {
      tenancyAssociation = "belongs_to :account";
      tenantKey = "account_id";
    }

    // Check schema / tables for ID type
    if (tables.length > 0) {
      const sampleTable = tables[0];
      if (sampleTable?.columns) {
        const idCol = sampleTable.columns.find((c) => c.name === "id");
        if (idCol?.type === "bigint" || idCol?.type === "integer") {
          idType = idCol.type;
        }
      }
    }

    return {
      tenancyAssociation,
      tenantKey,
      idType,
      encryptionHelper,
      timestamps
    };
  }

  public static findMigrationPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): MigrationPattern {
    const railsVersionFromManifest = manifest.versions?.["rails"];
    let railsVersion = "8.0";
    let uuidPrimaryKey = true;
    const foreignKeyConstraints = true;
    const indexesConvention = true;

    if (railsVersionFromManifest) {
      railsVersion = railsVersionFromManifest.startsWith("8")
        ? "8.0"
        : railsVersionFromManifest.startsWith("7.1")
        ? "7.1"
        : "7.0";
    }

    const modelPattern = this.findModelPattern(manifest, _graph);
    uuidPrimaryKey = modelPattern.idType === "uuid";

    return {
      railsVersion,
      uuidPrimaryKey,
      foreignKeyConstraints,
      indexesConvention
    };
  }

  public static findTestPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): TestPattern {
    const specs = manifest.tests?.specs || [];
    let framework: "rspec" | "minitest" = "rspec";
    const specTypes = {
      model: false,
      request: false,
      policy: false,
      job: false,
      service: false
    };

    if (manifest.tests?.frameworks && manifest.tests.frameworks.includes("minitest")) {
      framework = "minitest";
    }

    if (specs.length > 0) {
      framework = "rspec";
      specTypes.model = specs.some((s) => s.type === "model");
      specTypes.request = specs.some((s) => s.type === "request");
      specTypes.policy = specs.some((s) => s.type === "policy");
      specTypes.job = specs.some((s) => s.type === "job");
      specTypes.service = specs.some((s) => s.type === "service");
    } else {
      // Default to standard Rails RSpec structure
      framework = "rspec";
      specTypes.model = true;
      specTypes.request = true;
      specTypes.policy = true;
      specTypes.job = true;
      specTypes.service = true;
    }

    return {
      framework,
      specTypes,
      authHeaderHelper: '{ "Authorization" => "Bearer #{api_key.raw_token}" }',
      factoryPattern: "factory_bot"
    };
  }

  public static findAdminPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): AdminPattern {
    const adminResources = manifest.backend.adminResources || [];
    const adminType = manifest.admin?.type || "none";
    let framework: "active_admin" | "rails_admin" | "custom" | "none" = "none";
    let resourcePath = "app/admin";

    if (adminType === "active_admin" || adminResources.length > 0) {
      framework = "active_admin";
      resourcePath = "app/admin";
    }

    return {
      framework,
      resourcePath
    };
  }

  public static findFrontendPattern(manifest: RepositoryManifest, _graph?: ArchitectureGraphData | undefined): FrontendPattern {
    let framework: "next_app_router" | "next_pages_router" | "none" = "none";
    let apiClient = "fetch";
    const authStorage = "bearer_token";

    if (manifest.frontend?.routes && manifest.frontend.routes.length > 0) {
      const hasAppRouter = manifest.frontend.routes.some((r) => r.path.includes("app/"));
      framework = hasAppRouter ? "next_app_router" : "next_pages_router";
      apiClient = "@/lib/api-client";
    }

    return {
      framework,
      apiClient,
      authStorage
    };
  }
}
