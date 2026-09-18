export class SecretPolicy {
  private static readonly SECRET_PATTERNS = [
    /sk_live_[0-9a-zA-Z]{24,}/g,
    /sk-proj-[0-9a-zA-Z]{20,}/g,
    /ghp_[0-9a-zA-Z]{36}/g,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g
  ];

  public static containsRawLiveSecret(content: string): { hasSecret: boolean; reason?: string } {
    for (const pattern of this.SECRET_PATTERNS) {
      if (pattern.test(content)) {
        return {
          hasSecret: true,
          reason: "Content appears to contain an unmasked raw production secret or private key."
        };
      }
    }
    return { hasSecret: false };
  }
}
