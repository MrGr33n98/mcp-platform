export interface EnvironmentPolicyCheckResult {
  allowed: boolean;
  blockedVariables: string[];
  reason?: string | undefined;
}

export class EnvironmentPolicy {
  private static readonly BLOCKED_VALUES: Record<string, RegExp[]> = {
    RAILS_ENV: [/production/i, /staging/i],
    RACK_ENV: [/production/i, /staging/i],
    NODE_ENV: [/production/i],
    DATABASE_URL: [/prod/i, /amazonaws\.com/i, /digitalocean\.com/i, /supabase\.co/i, /neon\.tech/i],
    REDIS_URL: [/prod/i, /rediss:\/\//i],
    STRIPE_SECRET_KEY: [/^sk_live_/i],
    STRIPE_API_KEY: [/^rk_live_/i],
    AWS_SECRET_ACCESS_KEY: [/.+/],
    SPACES_SECRET_KEY: [/.+/]
  };

  public static evaluateEnvironment(env: Record<string, string | undefined>): EnvironmentPolicyCheckResult {
    const blockedVariables: string[] = [];

    for (const [key, patterns] of Object.entries(this.BLOCKED_VALUES)) {
      const val = env[key];
      if (val) {
        for (const pattern of patterns) {
          if (pattern.test(val)) {
            blockedVariables.push(`${key} (matches ${pattern.toString()})`);
          }
        }
      }
    }

    if (blockedVariables.length > 0) {
      return {
        allowed: false,
        blockedVariables,
        reason: `Environment contains production or sensitive credentials: ${blockedVariables.join(", ")}`
      };
    }

    return {
      allowed: true,
      blockedVariables: []
    };
  }

  public static sanitizeEnvironmentForExecution(baseEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
    const safeEnv: Record<string, string> = {
      ...baseEnv as Record<string, string>,
      RAILS_ENV: "test",
      RACK_ENV: "test",
      NODE_ENV: "test",
      CI: "true"
    };

    // Strip out any potentially sensitive production variables
    delete safeEnv.DATABASE_URL;
    delete safeEnv.PRODUCTION_DATABASE_URL;
    delete safeEnv.STRIPE_SECRET_KEY;
    delete safeEnv.STRIPE_API_KEY;
    delete safeEnv.AWS_SECRET_ACCESS_KEY;
    delete safeEnv.SPACES_SECRET_KEY;

    return safeEnv;
  }
}
