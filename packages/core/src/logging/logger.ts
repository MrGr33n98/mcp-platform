import { redactSecrets, redactString } from "./redaction.js";

export const logLevels = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof logLevels)[number];

export interface LogFields {
  readonly product?: string;
  readonly tool?: string;
  readonly requestId?: string;
  readonly durationMs?: number;
  readonly status?: string;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

export type LogWriter = (line: string) => void;

const levelPriority: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class ConsoleLogger implements Logger {
  constructor(
    private readonly minimumLevel: LogLevel,
    private readonly writeLine: LogWriter = (line) => process.stderr.write(line),
  ) {}

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (levelPriority[level] < levelPriority[this.minimumLevel]) {
      return;
    }

    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: redactString(message),
    };

    if (fields?.product !== undefined) entry.product = fields.product;
    if (fields?.tool !== undefined) entry.tool = fields.tool;
    if (fields?.requestId !== undefined) entry.request_id = fields.requestId;
    if (fields?.durationMs !== undefined) entry.duration_ms = fields.durationMs;
    if (fields?.status !== undefined) entry.status = fields.status;

    this.writeLine(`${JSON.stringify(redactSecrets(entry))}\n`);
  }
}
