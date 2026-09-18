export class TimestampNormalizer {
  public static normalize(rawTimestamp: unknown): string {
    if (!rawTimestamp) {
      return new Date().toISOString();
    }

    if (typeof rawTimestamp === "number") {
      // Check if seconds or milliseconds
      const ms = rawTimestamp < 1e12 ? rawTimestamp * 1000 : rawTimestamp;
      return new Date(ms).toISOString();
    }

    if (typeof rawTimestamp === "string") {
      const trimmed = rawTimestamp.trim();

      // Check standard ISO
      const parsed = Date.parse(trimmed);
      if (!isNaN(parsed)) {
        return new Date(parsed).toISOString();
      }

      // Check Rails log format [YYYY-MM-DD HH:MM:SS] or YYYY-MM-DD HH:MM:SS
      const railsMatch = trimmed.match(/^\[?(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:\d{2})(?:\.(\d+))?(?:\s*([+-]\d{2}:?\d{2}|Z))?\]?/);
      if (railsMatch) {
        const datePart = railsMatch[1];
        const timePart = railsMatch[2];
        const frac = railsMatch[3] ? `.${railsMatch[3]}` : "";
        const tz = railsMatch[4] || "Z";
        const constructed = `${datePart}T${timePart}${frac}${tz}`;
        const p2 = Date.parse(constructed);
        if (!isNaN(p2)) {
          return new Date(p2).toISOString();
        }
      }
    }

    return new Date().toISOString();
  }
}
