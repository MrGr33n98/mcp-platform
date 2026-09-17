export interface McpPlatformErrorOptions {
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
}

export class McpPlatformError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(options: McpPlatformErrorOptions) {
    super(options.message);
    this.name = "McpPlatformError";
    this.code = options.code;
    this.retryable = options.retryable ?? false;
  }
}
