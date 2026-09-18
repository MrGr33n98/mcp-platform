import path from "node:path";
import fs from "node:fs/promises";
import type { RepositoryValidationResult, Evidence, WorkspaceType, ValidationStatus } from "../types.js";
import { UnsafeFilePolicy } from "../security/unsafe-file-policy.js";

export class RepositoryRootValidator {
  public static async validate(rootPath: string): Promise<RepositoryValidationResult> {
    const resolvedRoot = path.resolve(rootPath);
    const evidence: Evidence[] = [];
    const backendRoots: string[] = [];
    const frontendRoots: string[] = [];
    const nestedApps: string[] = [];

    // Check directory accessibility
    try {
      const stat = await fs.stat(resolvedRoot);
      if (!stat.isDirectory()) {
        return {
          status: "INVALID",
          workspace_type: "UNKNOWN",
          repository_root: resolvedRoot,
          backend_roots: [],
          frontend_roots: [],
          nested_apps: [],
          evidence: [],
          reason: "Provided path is not a directory."
        };
      }
    } catch {
      return {
        status: "INVALID",
        workspace_type: "UNKNOWN",
        repository_root: resolvedRoot,
        backend_roots: [],
        frontend_roots: [],
        nested_apps: [],
        evidence: [],
        reason: "Directory does not exist or is not readable."
      };
    }

    // Check direct root
    const rootRailsEvidence = await this.checkRails(resolvedRoot);
    if (rootRailsEvidence) {
      backendRoots.push(resolvedRoot);
      evidence.push(...rootRailsEvidence);
    }

    const rootNextEvidence = await this.checkNext(resolvedRoot);
    if (rootNextEvidence) {
      frontendRoots.push(resolvedRoot);
      evidence.push(...rootNextEvidence);
    }

    // Search subdirectories (depth 1 and 2)
    try {
      const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subName = entry.name;
        if (UnsafeFilePolicy.isIgnored(path.join(resolvedRoot, subName))) continue;
        if (subName.startsWith(".") || subName === "node_modules" || subName === "vendor" || subName === "tmp" || subName === "log") continue;

        const subPath = path.join(resolvedRoot, subName);

        // Check direct subfolder
        const subRails = await this.checkRails(subPath);
        if (subRails) {
          backendRoots.push(subPath);
          nestedApps.push(subPath);
          evidence.push(...subRails);
        }

        const subNext = await this.checkNext(subPath);
        if (subNext) {
          frontendRoots.push(subPath);
          nestedApps.push(subPath);
          evidence.push(...subNext);
        }

        // If it's an "apps" or "packages" directory, look one level deeper
        if (subName === "apps" || subName === "packages" || subName === "services") {
          try {
            const nestedEntries = await fs.readdir(subPath, { withFileTypes: true });
            for (const nestedEntry of nestedEntries) {
              if (!nestedEntry.isDirectory()) continue;
              const nestedSubPath = path.join(subPath, nestedEntry.name);
              const deepRails = await this.checkRails(nestedSubPath);
              if (deepRails) {
                backendRoots.push(nestedSubPath);
                nestedApps.push(nestedSubPath);
                evidence.push(...deepRails);
              }
              const deepNext = await this.checkNext(nestedSubPath);
              if (deepNext) {
                frontendRoots.push(nestedSubPath);
                nestedApps.push(nestedSubPath);
                evidence.push(...deepNext);
              }
            }
          } catch {
            // Ignore nested read error
          }
        }
      }
    } catch {
      // Ignore directory scan error
    }

    // Deduplicate
    const uniqueBackends = [...new Set(backendRoots)];
    const uniqueFrontends = [...new Set(frontendRoots)];
    const uniqueNested = [...new Set(nestedApps)];

    // Determine Workspace Type & Validation Status
    let workspace_type: WorkspaceType = "UNKNOWN";
    let status: ValidationStatus = "NOT_VERIFIED";
    let reason: string | undefined = undefined;

    if (uniqueBackends.length === 0 && uniqueFrontends.length === 0) {
      status = "NOT_VERIFIED";
      workspace_type = "UNKNOWN";
      reason = `No detectable Rails or Next.js application root found in ${resolvedRoot}.`;
    } else if (uniqueNested.length > 0) {
      if (uniqueBackends.length > 0 && uniqueFrontends.length > 0) {
        workspace_type = "NESTED_BACK_FRONT";
        status = "VALID";
      } else {
        workspace_type = "MONOREPO";
        status = "PARTIAL";
        reason = "Partial multi-app workspace detected.";
      }
    } else {
      workspace_type = "SINGLE_APP";
      status = "VALID";
    }

    return {
      status,
      workspace_type,
      repository_root: resolvedRoot,
      backend_roots: uniqueBackends,
      frontend_roots: uniqueFrontends,
      nested_apps: uniqueNested,
      evidence,
      reason
    };
  }

  private static async checkRails(dir: string): Promise<Evidence[] | null> {
    const evidences: Evidence[] = [];
    const gemfilePath = path.join(dir, "Gemfile");
    const routesPath = path.join(dir, "config", "routes.rb");
    const appConfigPath = path.join(dir, "config", "application.rb");

    let hasGemfile = false;
    let hasRoutes = false;
    let hasAppConfig = false;

    try {
      const gf = await fs.readFile(gemfilePath, "utf-8");
      if (gf.includes("rails") || gf.includes("railties")) {
        hasGemfile = true;
        evidences.push({
          file: gemfilePath,
          evidence_type: "DEPENDENCY",
          detector: "RepositoryRootValidator",
          confidence: "HIGH",
          description: "Found Rails gem in Gemfile."
        });
      }
    } catch {}

    try {
      await fs.stat(routesPath);
      hasRoutes = true;
      evidences.push({
        file: routesPath,
        evidence_type: "FILE_EXISTS",
        detector: "RepositoryRootValidator",
        confidence: "HIGH",
        description: "Found config/routes.rb."
      });
    } catch {}

    try {
      await fs.stat(appConfigPath);
      hasAppConfig = true;
      evidences.push({
        file: appConfigPath,
        evidence_type: "FILE_EXISTS",
        detector: "RepositoryRootValidator",
        confidence: "HIGH",
        description: "Found config/application.rb."
      });
    } catch {}

    if (hasGemfile || (hasRoutes && hasAppConfig)) {
      return evidences;
    }

    return null;
  }

  private static async checkNext(dir: string): Promise<Evidence[] | null> {
    const evidences: Evidence[] = [];
    const pkgJsonPath = path.join(dir, "package.json");
    const nextConfigJs = path.join(dir, "next.config.js");
    const nextConfigMjs = path.join(dir, "next.config.mjs");
    const nextConfigTs = path.join(dir, "next.config.ts");

    let hasNextPkg = false;
    let hasNextConfig = false;

    try {
      const pkg = await fs.readFile(pkgJsonPath, "utf-8");
      if (pkg.includes('"next"') || pkg.includes("'next'")) {
        hasNextPkg = true;
        evidences.push({
          file: pkgJsonPath,
          evidence_type: "DEPENDENCY",
          detector: "RepositoryRootValidator",
          confidence: "HIGH",
          description: "Found Next.js dependency in package.json."
        });
      }
    } catch {}

    for (const confPath of [nextConfigJs, nextConfigMjs, nextConfigTs]) {
      try {
        await fs.stat(confPath);
        hasNextConfig = true;
        evidences.push({
          file: confPath,
          evidence_type: "CONFIG",
          detector: "RepositoryRootValidator",
          confidence: "HIGH",
          description: `Found ${path.basename(confPath)}.`
        });
        break;
      } catch {}
    }

    if (hasNextPkg || hasNextConfig) {
      return evidences;
    }

    return null;
  }
}
