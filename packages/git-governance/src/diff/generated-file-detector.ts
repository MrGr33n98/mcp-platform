export class GeneratedFileDetector {
  private static readonly GENERATED_EXTENSIONS = [
    ".min.js",
    ".min.css",
    ".map",
    ".bundle.js",
  ];

  private static readonly GENERATED_PATTERNS = [
    /package-lock\.json$/,
    /yarn\.lock$/,
    /pnpm-lock\.yaml$/,
    /Gemfile\.lock$/,
    /db\/schema\.rb$/,
  ];

  public static isGenerated(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, "/");

    for (const ext of this.GENERATED_EXTENSIONS) {
      if (normalized.endsWith(ext)) return true;
    }

    for (const pattern of this.GENERATED_PATTERNS) {
      if (pattern.test(normalized)) return true;
    }

    return false;
  }
}
