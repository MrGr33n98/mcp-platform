const REDACTED = "[REDACTED]";

const sensitiveKeyFragments = [
  "authorization",
  "apikey",
  "token",
  "password",
  "secret",
  "cookie",
] as const;

const namedSecretPattern = /((?:"?(?:api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|password|secret|cookie|set-cookie)"?)\s*(?:=|:)\s*["']?)([^"'\s,;}&]+)/gi;
const authorizationPattern = /(authorization\s*:\s*bearer\s+)([^\s,;]+)/gi;
const bearerPattern = /(\bbearer\s+)([A-Za-z0-9._~+/=-]+)/gi;
const windowsAbsolutePathPattern = /\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/g;
const posixAbsolutePathPattern = /(^|[\s(])\/(?:[^/\s]+\/)*[^/\s]+/g;

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
  return sensitiveKeyFragments.some((fragment) => normalized.includes(fragment));
}

export function redactString(value: string): string {
  return value
    .replace(authorizationPattern, `$1${REDACTED}`)
    .replace(namedSecretPattern, `$1${REDACTED}`)
    .replace(bearerPattern, `$1${REDACTED}`)
    .replace(windowsAbsolutePathPattern, "[REDACTED_PATH]")
    .replace(posixAbsolutePathPattern, `$1[REDACTED_PATH]`);
}

export function redactSecrets(value: unknown): unknown {
  return redactValue(value, new WeakSet<object>());
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, seen));
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (value !== null && typeof value === "object") {
    if (seen.has(value)) {
      return "[REDACTED_CIRCULAR]";
    }

    seen.add(value);
    const redacted: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      redacted[key] = isSensitiveKey(key) ? REDACTED : redactValue(nestedValue, seen);
    }
    return redacted;
  }

  return value;
}
