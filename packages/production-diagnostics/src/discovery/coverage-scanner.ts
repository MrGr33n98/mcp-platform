import * as fs from "node:fs";
import * as path from "node:path";
import type { ObservabilityCoverage, CoverageStatus } from "../types.js";

export class CoverageScanner {
  public static scanRepository(repositoryRoot: string): ObservabilityCoverage {
    const configuredProviders: string[] = [];

    const hasFile = (rel: string): boolean => {
      try {
        return fs.existsSync(path.join(repositoryRoot, rel));
      } catch {
        return false;
      }
    };

    const fileContains = (rel: string, text: string): boolean => {
      try {
        const full = path.join(repositoryRoot, rel);
        if (!fs.existsSync(full)) return false;
        const content = fs.readFileSync(full, "utf8");
        return content.includes(text);
      } catch {
        return false;
      }
    };

    // 1. Logs
    let logs: CoverageStatus = "AVAILABLE"; // Standard Rails log or stderr is available
    if (hasFile("log") || hasFile("config/environments/production.rb")) {
      configuredProviders.push("Rails Logs (log_stream)");
    }

    // 2. Metrics & APM
    let metrics: CoverageStatus = "UNAVAILABLE";
    if (fileContains("Gemfile", "newrelic_rpm") || hasFile("config/newrelic.yml")) {
      metrics = "AVAILABLE";
      configuredProviders.push("New Relic APM");
    } else if (fileContains("Gemfile", "datadog") || fileContains("Gemfile", "ddtrace")) {
      metrics = "AVAILABLE";
      configuredProviders.push("Datadog APM");
    }

    // 3. Error Tracker
    let errors: CoverageStatus = "UNAVAILABLE";
    if (fileContains("Gemfile", "sentry-ruby") || hasFile("config/initializers/sentry.rb")) {
      errors = "AVAILABLE";
      configuredProviders.push("Sentry Error Tracker");
    } else if (fileContains("Gemfile", "rollbar") || hasFile("config/initializers/rollbar.rb")) {
      errors = "AVAILABLE";
      configuredProviders.push("Rollbar Error Tracker");
    }

    // 4. Deployments
    let deployments: CoverageStatus = "PARTIAL";
    if (hasFile(".git") || hasFile(".github/workflows")) {
      configuredProviders.push("Git / GitHub Deployments");
    }

    // 5. Database
    let database: CoverageStatus = "UNAVAILABLE";
    if (hasFile("config/database.yml")) {
      database = "AVAILABLE";
      configuredProviders.push("PostgreSQL (ActiveRecord Database Health)");
    }

    // 6. Redis & Jobs (Sidekiq)
    let redis: CoverageStatus = "UNAVAILABLE";
    let jobs: CoverageStatus = "UNAVAILABLE";
    if (fileContains("Gemfile", "sidekiq") || hasFile("config/sidekiq.yml")) {
      jobs = "AVAILABLE";
      redis = "AVAILABLE";
      configuredProviders.push("Sidekiq Queue Health");
      configuredProviders.push("Redis Store");
    }

    // 7. Storage
    let storage: CoverageStatus = "UNAVAILABLE";
    if (hasFile("config/storage.yml")) {
      storage = "AVAILABLE";
      configuredProviders.push("ActiveStorage / S3 Object Health");
    }

    // 8. Traces
    const traces: CoverageStatus = metrics === "AVAILABLE" ? "AVAILABLE" : "UNAVAILABLE";

    // 9. Analytics (e.g. PostHog)
    if (fileContains("Gemfile", "posthog") || hasFile("config/initializers/posthog.rb")) {
      configuredProviders.push("PostHog Analytics");
    }

    return {
      logs,
      metrics,
      errors,
      deployments,
      database,
      redis,
      jobs,
      storage,
      traces,
      configured_providers: configuredProviders,
    };
  }
}
