export interface PredefinedQuery {
  id: string;
  purpose: string;
  sql: string;
  read_only: true;
  timeout_ms: number;
  max_rows: number;
}

export class QueryPolicy {
  private static readonly FORBIDDEN_KEYWORDS = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "REPLACE",
    "GRANT",
    "REVOKE",
    "VACUUM FULL",
    "LOCK TABLE",
    "KILL",
    "SHUTDOWN",
  ];

  public static readonly QUERY_REGISTRY: Record<string, PredefinedQuery> = {
    PG_STAT_ACTIVITY: {
      id: "PG_STAT_ACTIVITY",
      purpose: "Check active database connections and long-running queries",
      sql: "SELECT pid, now() - query_start AS duration, state, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 20;",
      read_only: true,
      timeout_ms: 3000,
      max_rows: 20,
    },
    PG_LOCKS: {
      id: "PG_LOCKS",
      purpose: "Check lock contentions and blocked processes",
      sql: "SELECT locktype, relation::regclass, mode, granted FROM pg_locks WHERE NOT granted LIMIT 50;",
      read_only: true,
      timeout_ms: 3000,
      max_rows: 50,
    },
    PG_DATABASE_SIZE: {
      id: "PG_DATABASE_SIZE",
      purpose: "Check database storage utilization",
      sql: "SELECT pg_database_size(current_database()) AS size_bytes;",
      read_only: true,
      timeout_ms: 2000,
      max_rows: 1,
    },
  };

  public static validateCustomQuery(sql: string): { valid: boolean; reason?: string | undefined } {
    const upper = sql.trim().toUpperCase();

    if (!upper.startsWith("SELECT ") && !upper.startsWith("EXPLAIN ") && !upper.startsWith("SHOW ")) {
      return { valid: false, reason: "Only SELECT, EXPLAIN, and SHOW statements are permitted." };
    }

    for (const keyword of this.FORBIDDEN_KEYWORDS) {
      const regex = new RegExp(`\\b${keyword}\\b`, "i");
      if (regex.test(sql)) {
        return { valid: false, reason: `Forbidden mutation keyword '${keyword}' detected in diagnostic query.` };
      }
    }

    return { valid: true };
  }
}
