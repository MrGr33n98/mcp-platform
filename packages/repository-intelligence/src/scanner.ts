import path from "node:path";
import fs from "node:fs/promises";
import type { RepositoryManifest, SecretFinding, ProductWorkspace, ScanCoverage } from "./types.js";
import { RailsDetector } from "./detectors/rails.js";
import { NextjsDetector } from "./detectors/nextjs.js";
import { InfraDetector } from "./detectors/infra.js";
import { RailsRoutesParser } from "./parsers/rails-routes.js";
import { RailsSchemaParser } from "./parsers/rails-schema.js";
import { RailsModelParser } from "./parsers/rails-model.js";
import { RailsControllerParser } from "./parsers/rails-controller.js";
import { RailsPolicyParser } from "./parsers/rails-policy.js";
import { RailsServiceParser } from "./parsers/rails-service.js";
import { RailsJobParser } from "./parsers/rails-job.js";
import { ActiveAdminParser } from "./parsers/active-admin.js";
import { NextRouteParser } from "./parsers/next-route.js";
import { RailsSpecParser } from "./parsers/rails-spec.js";
import { RepositoryRootValidator } from "./validator/repository-root-validator.js";
import { UnsafeFilePolicy } from "./security/unsafe-file-policy.js";
import { SecretDetector } from "./security/secret-detector.js";

export class RepositoryScanner {
  public static async scan(repoRoot: string): Promise<RepositoryManifest> {
    const resolvedRoot = path.resolve(repoRoot);
    const repoName = path.basename(resolvedRoot);

    // Validate root structure
    const validation = await RepositoryRootValidator.validate(resolvedRoot);

    const railsInfo = await RailsDetector.detect(resolvedRoot);
    const nextInfo = await NextjsDetector.detect(resolvedRoot);
    const infraInfo = await InfraDetector.detect(resolvedRoot);

    let parseFailures = 0;
    const limitations: string[] = [];

    let routes: any[] = [];
    let tables: any[] = [];
    let models: any[] = [];
    let controllers: any[] = [];
    let policies: any[] = [];
    let services: any[] = [];
    let jobs: any[] = [];
    let adminResources: any[] = [];
    let nextRoutes: any[] = [];
    let specs: any[] = [];

    if (railsInfo.isRails) {
      try { routes = await RailsRoutesParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing routes.rb"); }
      try { tables = await RailsSchemaParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing db/schema.rb"); }
      try { models = await RailsModelParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing models"); }
      try { controllers = await RailsControllerParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing controllers"); }
      try { policies = await RailsPolicyParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing policies"); }
      try { services = await RailsServiceParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing services"); }
      try { jobs = await RailsJobParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing jobs"); }
      try { specs = await RailsSpecParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing specs"); }
      if (railsInfo.hasActiveAdmin) {
        try { adminResources = await ActiveAdminParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing ActiveAdmin resources"); }
      }
    }

    if (nextInfo.isNextjs) {
      try { nextRoutes = await NextRouteParser.parse(resolvedRoot); } catch { parseFailures++; limitations.push("Failed parsing Next.js routes"); }
    }

    const secretFindings: SecretFinding[] = [];
    const unsafeFilesBlocked: string[] = [];
    let filesDiscovered = 0;
    let filesScanned = 0;
    let filesSkipped = 0;

    async function walkAndCheckSecrets(dir: string) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          filesDiscovered++;

          if (UnsafeFilePolicy.isIgnored(fullPath)) {
            filesSkipped++;
            continue;
          }

          if (entry.isDirectory()) {
            await walkAndCheckSecrets(fullPath);
          } else if (entry.isFile()) {
            if (entry.name.endsWith(".rb") || entry.name.endsWith(".ts") || entry.name.endsWith(".js") || entry.name.endsWith(".env") || entry.name.endsWith(".yml")) {
              if (!UnsafeFilePolicy.isSafePath(fullPath, resolvedRoot)) {
                unsafeFilesBlocked.push(fullPath);
                filesSkipped++;
                continue;
              }

              filesScanned++;
              try {
                const content = await fs.readFile(fullPath, "utf-8");
                const lines = content.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  const line = lines[i];
                  if (line) {
                    const finding = SecretDetector.scanLine(line, i + 1, fullPath);
                    if (finding) secretFindings.push(finding);
                  }
                }
              } catch {
                parseFailures++;
              }
            } else {
              filesSkipped++;
            }
          }
        }
      } catch {
        // Directory access error
      }
    }

    await walkAndCheckSecrets(resolvedRoot);

    const scanCoverage: ScanCoverage = {
      files_discovered: filesDiscovered,
      files_scanned: filesScanned,
      files_skipped: filesSkipped,
      parse_failures: parseFailures,
      unsupported_files: 0,
      coverage_confidence: validation.status === "VALID" ? "HIGH" : validation.status === "PARTIAL" ? "MEDIUM" : "LOW",
      limitations
    };

    const manifest: RepositoryManifest = {
      manifestVersion: 1,
      scannedAt: new Date().toISOString(),
      validation,
      scanCoverage,
      repository: {
        path: resolvedRoot,
        name: repoName
      },
      stack: {
        backend: railsInfo.isRails ? "rails" : "unknown",
        frontend: nextInfo.isNextjs ? "nextjs" : "none",
        database: railsInfo.hasPostgres ? "postgres" : "unknown",
        postgis: railsInfo.hasPostgis,
        queue: railsInfo.hasSidekiq ? "sidekiq" : railsInfo.hasRedis ? "redis" : "none",
        storage: railsInfo.hasActiveStorage ? "active_storage" : "unknown"
      },
      versions: {
        ...(railsInfo.railsVersion ? { rails: railsInfo.railsVersion } : {}),
        ...(railsInfo.rubyVersion ? { ruby: railsInfo.rubyVersion } : {}),
        ...(nextInfo.nextVersion ? { nextjs: nextInfo.nextVersion } : {}),
        ...(nextInfo.reactVersion ? { react: nextInfo.reactVersion } : {})
      },
      backend: {
        framework: railsInfo.isRails ? `Rails ${railsInfo.railsVersion || ""}`.trim() : "unknown",
        routes,
        models,
        controllers,
        policies,
        services,
        jobs,
        mailers: [],
        adminResources,
        initializers: []
      },
      frontend: {
        framework: nextInfo.isNextjs ? `Next.js ${nextInfo.nextVersion || ""}`.trim() : "none",
        appRouter: nextInfo.hasAppRouter,
        pagesRouter: nextInfo.hasPagesRouter,
        routes: nextRoutes,
        components: [],
        hooks: [],
        uiLibrary: nextInfo.hasShadcn ? "shadcn" : nextInfo.hasTailwind ? "tailwind" : "none",
        styling: nextInfo.hasTailwind ? ["tailwind"] : []
      },
      database: {
        type: railsInfo.hasPostgres ? "PostgreSQL" : "unknown",
        postgis: railsInfo.hasPostgis,
        tables,
        migrations: []
      },
      background_jobs: {
        runner: railsInfo.hasSidekiq ? "Sidekiq" : "none",
        queues: [...new Set(jobs.map((j) => j.queue))],
        jobs: jobs.map((j) => j.name)
      },
      storage: {
        provider: railsInfo.hasActiveStorage ? "ActiveStorage / S3" : "unknown",
        activeStorage: railsInfo.hasActiveStorage,
        s3Compatible: railsInfo.gems.includes("aws-sdk-s3")
      },
      auth: {
        mechanisms: [
          ...(railsInfo.hasDevise ? ["Devise"] : []),
          ...(railsInfo.gems.includes("devise-jwt") ? ["JWT"] : [])
        ],
        mfa: false,
        oauth: [],
        apiKeys: models.some((m) => m.name.toLowerCase().includes("apikey"))
      },
      admin: {
        type: railsInfo.hasActiveAdmin ? "active_admin" : "none",
        resources: adminResources.map((r) => r.name)
      },
      tests: {
        frameworks: ["RSpec / Minitest"],
        specCount: specs.length,
        testPaths: specs.map((s) => s.file),
        specs
      },
      infra: {
        docker: infraInfo.hasDocker,
        compose: infraInfo.hasDockerCompose,
        githubActions: infraInfo.hasGithubActions,
        workflows: infraInfo.workflows
      },
      security: {
        secretFindings,
        unsafeFilesBlocked
      },
      unknowns: []
    };

    return manifest;
  }
}

export class ProductWorkspaceScanner {
  public static async scanWorkspace(workspaceRoot: string): Promise<ProductWorkspace> {
    const resolvedRoot = path.resolve(workspaceRoot);
    const validation = await RepositoryRootValidator.validate(resolvedRoot);
    const manifests: Record<string, RepositoryManifest> = {};

    if (validation.status === "NOT_VERIFIED" || validation.status === "INVALID") {
      // Return unverified product workspace without inventing components
      return {
        name: path.basename(resolvedRoot),
        rootPath: resolvedRoot,
        validation,
        backendRoots: [],
        frontendRoots: [],
        manifests: {}
      };
    }

    // Scan all detected backend roots
    for (const bRoot of validation.backend_roots) {
      const relKey = path.relative(resolvedRoot, bRoot) || "backend";
      manifests[relKey] = await RepositoryScanner.scan(bRoot);
    }

    // Scan all detected frontend roots
    for (const fRoot of validation.frontend_roots) {
      const relKey = path.relative(resolvedRoot, fRoot) || "frontend";
      if (!manifests[relKey]) {
        manifests[relKey] = await RepositoryScanner.scan(fRoot);
      }
    }

    // If it was a single app root at the top level
    if (Object.keys(manifests).length === 0) {
      manifests["root"] = await RepositoryScanner.scan(resolvedRoot);
    }

    return {
      name: path.basename(resolvedRoot),
      rootPath: resolvedRoot,
      validation,
      backendRoots: validation.backend_roots,
      frontendRoots: validation.frontend_roots,
      manifests
    };
  }
}
