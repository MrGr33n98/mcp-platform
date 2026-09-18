import fs from "node:fs/promises";
import path from "node:path";

export interface NextjsDetectionResult {
  isNextjs: boolean;
  nextVersion?: string;
  reactVersion?: string;
  hasTypescript: boolean;
  hasTailwind: boolean;
  hasShadcn: boolean;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
}

export class NextjsDetector {
  public static async detect(repoRoot: string): Promise<NextjsDetectionResult> {
    const result: NextjsDetectionResult = {
      isNextjs: false,
      hasTypescript: false,
      hasTailwind: false,
      hasShadcn: false,
      hasAppRouter: false,
      hasPagesRouter: false
    };

    let pkgContent = "";
    const possiblePaths = [
      path.join(repoRoot, "package.json"),
      path.join(repoRoot, "frontend", "package.json"),
      path.join(repoRoot, "client", "package.json")
    ];

    let foundDir = repoRoot;
    for (const p of possiblePaths) {
      try {
        pkgContent = await fs.readFile(p, "utf-8");
        foundDir = path.dirname(p);
        break;
      } catch {
        // Continue
      }
    }

    if (!pkgContent) {
      return result;
    }

    try {
      const parsed = JSON.parse(pkgContent);
      const allDeps = {
        ...parsed.dependencies,
        ...parsed.devDependencies
      };

      if (allDeps["next"]) {
        result.isNextjs = true;
        result.nextVersion = allDeps["next"];
      }

      if (allDeps["react"]) {
        result.reactVersion = allDeps["react"];
      }

      result.hasTypescript = !!allDeps["typescript"];
      result.hasTailwind = !!allDeps["tailwindcss"];
      result.hasShadcn = !!allDeps["lucide-react"] || !!allDeps["@radix-ui/react-slot"] || !!allDeps["class-variance-authority"];

      // Check app router vs pages router
      try {
        const appStat = await fs.stat(path.join(foundDir, "app"));
        if (appStat.isDirectory()) result.hasAppRouter = true;
      } catch {
        try {
          const srcAppStat = await fs.stat(path.join(foundDir, "src", "app"));
          if (srcAppStat.isDirectory()) result.hasAppRouter = true;
        } catch {
          // No app router
        }
      }

      try {
        const pagesStat = await fs.stat(path.join(foundDir, "pages"));
        if (pagesStat.isDirectory()) result.hasPagesRouter = true;
      } catch {
        try {
          const srcPagesStat = await fs.stat(path.join(foundDir, "src", "pages"));
          if (srcPagesStat.isDirectory()) result.hasPagesRouter = true;
        } catch {
          // No pages router
        }
      }

      // Check for components.json (shadcn signature)
      try {
        await fs.access(path.join(foundDir, "components.json"));
        result.hasShadcn = true;
      } catch {
        //
      }

    } catch {
      // Invalid json
    }

    return result;
  }
}
