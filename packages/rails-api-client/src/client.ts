import {
  McpPlatformError,
  type Logger,
} from "@mcp-platform/core";
import {
  parseRailsApiClientConfig,
  type RailsApiClientConfig,
  type ValidatedRailsApiClientConfig,
} from "./config.js";
import {
  createRailsApiHttpError,
  createRailsApiNetworkError,
  createRailsApiTimeoutError,
} from "./errors.js";
import { createDefaultHeaders } from "./headers.js";
import { buildRelativeApiUrl, type RailsApiGetRequest } from "./request.js";
import { isRetryableStatus, retryDelayMs, shouldRetry, waitForRetry } from "./retry.js";
import { readJsonResponse, validateResponse } from "./response.js";

export interface RailsApiClientDependencies {
  readonly fetch?: typeof fetch;
  readonly logger?: Logger;
  readonly wait?: (delayMs: number) => Promise<void>;
}

export class RailsApiClient {
  readonly #config: ValidatedRailsApiClientConfig;
  readonly #fetch: typeof fetch;
  readonly #logger: Logger | undefined;
  readonly #wait: (delayMs: number) => Promise<void>;

  constructor(
    config: RailsApiClientConfig,
    dependencies: RailsApiClientDependencies = {},
  ) {
    this.#config = parseRailsApiClientConfig(config);
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#logger = dependencies.logger;
    this.#wait = dependencies.wait ?? waitForRetry;

    if (typeof this.#fetch !== "function") {
      throw new McpPlatformError({
        code: "RAILS_API_UNAVAILABLE",
        message: "The configured runtime does not provide HTTP fetch support.",
        retryable: false,
      });
    }
  }

  async get<TResponse = unknown>(
    request: RailsApiGetRequest<TResponse>,
  ): Promise<TResponse> {
    const url = buildRelativeApiUrl(
      this.#config.baseUrl,
      request.path,
      request.query,
    );
    const headers = createDefaultHeaders(this.#config, request.requestId);

    for (let attempt = 0; ; attempt += 1) {
      const startedAt = Date.now();
      let response: Response;

      try {
        response = await this.fetchWithTimeout(url, headers);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (error instanceof RailsApiRequestTimeoutError) {
          if (shouldRetry(attempt, this.#config.maxRetries)) {
            this.log("warn", request, attempt, "timeout_retry", durationMs);
            await this.#wait(retryDelayMs(attempt));
            continue;
          }

          this.log("warn", request, attempt, "timeout", durationMs);
          throw createRailsApiTimeoutError();
        }

        if (shouldRetry(attempt, this.#config.maxRetries)) {
          this.log("warn", request, attempt, "network_retry", durationMs);
          await this.#wait(retryDelayMs(attempt));
          continue;
        }

        this.log("warn", request, attempt, "network_error", durationMs);
        throw createRailsApiNetworkError();
      }

      const durationMs = Date.now() - startedAt;
      if (
        isRetryableStatus(response.status) &&
        shouldRetry(attempt, this.#config.maxRetries)
      ) {
        try {
          await response.body?.cancel();
        } catch {
          // The response is already being discarded for a bounded retry.
        }
        this.log("warn", request, attempt, String(response.status), durationMs);
        await this.#wait(retryDelayMs(attempt));
        continue;
      }

      if (!response.ok) {
        this.log("warn", request, attempt, String(response.status), durationMs);
        throw createRailsApiHttpError(response.status);
      }

      try {
        const parsed = await readJsonResponse(response, this.#config.maxResponseBytes);
        const validated = validateResponse(parsed, request.responseSchema);
        this.log("info", request, attempt, String(response.status), durationMs);
        return validated;
      } catch (error) {
        this.log("warn", request, attempt, "invalid_response", durationMs);
        throw error;
      }
    }
  }

  private async fetchWithTimeout(url: URL, headers: Headers): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#config.timeoutMs);

    try {
      return await this.#fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        redirect: "error",
      });
    } catch (error) {
      if (timedOut) {
        throw new RailsApiRequestTimeoutError();
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private log(
    level: "info" | "warn",
    request: RailsApiGetRequest,
    attempt: number,
    status: string,
    durationMs: number,
  ): void {
    this.#logger?.[level]("Rails API GET request completed.", {
      product: this.#config.productId,
      requestId: request.requestId,
      method: "GET",
      path: request.path,
      status,
      durationMs,
      attempt: attempt + 1,
    });
  }
}

class RailsApiRequestTimeoutError extends Error {}
