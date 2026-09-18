import path from "path";

export class FilePolicy {
  private static readonly PROTECTED_PATTERNS = [
    /^\.env(\..+)?$/i,
    /^credentials(\..+)?$/i,
    /^master\.key$/i,
    /\.pem$/i,
    /\.key$/i,
    /^id_rsa/i,
    /^id_ed25519/i,
    /secrets\.ya?ml(\.enc)?$/i,
    /\.git(\/|\\|$)/i
  ];

  public static isProtectedFile(relativePath: string): { protected: boolean; reason?: string } {
    const filename = path.basename(relativePath);
    const normalized = relativePath.replace(/\\/g, "/");

    for (const pattern of this.PROTECTED_PATTERNS) {
      if (pattern.test(filename) || pattern.test(normalized)) {
        return {
          protected: true,
          reason: `File '${relativePath}' is classified as a PROTECTED security file. Writes are strictly forbidden.`
        };
      }
    }

    return { protected: false };
  }
}
