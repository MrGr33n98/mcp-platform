import fs from "node:fs/promises";
import path from "node:path";

export interface RailsDetectionResult {
  isRails: boolean;
  railsVersion?: string | undefined;
  rubyVersion?: string | undefined;
  gems: string[];
  hasPostgres: boolean;
  hasPostgis: boolean;
  hasRedis: boolean;
  hasSidekiq: boolean;
  hasActiveAdmin: boolean;
  hasPundit: boolean;
  hasActiveStorage: boolean;
  hasStripe: boolean;
  hasDevise: boolean;
}

export class RailsDetector {
  public static async detect(repoRoot: string): Promise<RailsDetectionResult> {
    const result: RailsDetectionResult = {
      isRails: false,
      gems: [],
      hasPostgres: false,
      hasPostgis: false,
      hasRedis: false,
      hasSidekiq: false,
      hasActiveAdmin: false,
      hasPundit: false,
      hasActiveStorage: false,
      hasStripe: false,
      hasDevise: false
    };

    const gemfilePath = path.join(repoRoot, "Gemfile");
    const gemfileLockPath = path.join(repoRoot, "Gemfile.lock");

    let gemfileContent = "";
    try {
      gemfileContent = await fs.readFile(gemfilePath, "utf-8");
    } catch {
      try {
        gemfileContent = await fs.readFile(path.join(repoRoot, "backend", "Gemfile"), "utf-8");
      } catch {
        //
      }
    }

    let lockContent = "";
    try {
      lockContent = await fs.readFile(gemfileLockPath, "utf-8");
    } catch {
      try {
        lockContent = await fs.readFile(path.join(repoRoot, "backend", "Gemfile.lock"), "utf-8");
      } catch {
        //
      }
    }

    if (!gemfileContent && !lockContent) {
      return result;
    }

    const combined = (gemfileContent + "\n" + lockContent).toLowerCase();

    if (combined.includes("rails")) {
      result.isRails = true;
    }

    const railsVersionMatch = lockContent.match(/rails\s+\((\d+\.\d+\.\d+[\w.]*)\)/i);
    if (railsVersionMatch && railsVersionMatch[1]) {
      result.railsVersion = railsVersionMatch[1];
    }

    const rubyMatch = gemfileContent.match(/ruby\s+["']([^"']+)["']/i);
    if (rubyMatch && rubyMatch[1]) {
      result.rubyVersion = rubyMatch[1];
    }

    const knownGems = [
      "pg",
      "activerecord-postgis-adapter",
      "rgeo",
      "redis",
      "sidekiq",
      "activeadmin",
      "pundit",
      "activestorage",
      "stripe",
      "devise",
      "devise-jwt",
      "rodauth-rails",
      "posthog-ruby",
      "aws-sdk-s3"
    ];

    for (const gem of knownGems) {
      if (combined.includes(gem)) {
        result.gems.push(gem);
      }
    }

    result.hasPostgres = combined.includes("pg");
    result.hasPostgis = combined.includes("activerecord-postgis-adapter") || combined.includes("rgeo");
    result.hasRedis = combined.includes("redis");
    result.hasSidekiq = combined.includes("sidekiq");
    result.hasActiveAdmin = combined.includes("activeadmin");
    result.hasPundit = combined.includes("pundit");
    result.hasActiveStorage = combined.includes("activestorage") || combined.includes("aws-sdk-s3");
    result.hasStripe = combined.includes("stripe");
    result.hasDevise = combined.includes("devise");

    return result;
  }
}
