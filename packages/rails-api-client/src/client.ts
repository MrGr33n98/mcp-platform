import {
  McpPlatformError,
  type Logger,
  type RateLimiter,
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
import {
  buildRelativeApiUrl,
  type RailsApiGetRequest,
  type RailsApiMutationMethod,
  type RailsApiMutationRequest,
} from "./request.js";
import { isRetryableStatus, retryDelayMs, shouldRetry, waitForRetry } from "./retry.js";
import { readJsonResponse, validateResponse } from "./response.js";

export interface RailsApiClientDependencies {
  readonly fetch?: typeof fetch;
  readonly logger?: Logger;
  readonly wait?: (delayMs: number) => Promise<void>;
  readonly rateLimiter?: RateLimiter;
}

export class RailsApiClient {
  readonly #config: ValidatedRailsApiClientConfig;
  readonly #fetch: typeof fetch;
  readonly #logger: Logger | undefined;
  readonly #wait: (delayMs: number) => Promise<void>;
  readonly #rateLimiter: RateLimiter | undefined;

  constructor(
    config: RailsApiClientConfig,
    dependencies: RailsApiClientDependencies = {},
  ) {
    this.#config = parseRailsApiClientConfig(config);
    this.#fetch = dependencies.fetch ?? globalThis.fetch;
    this.#logger = dependencies.logger;
    this.#wait = dependencies.wait ?? waitForRetry;
    this.#rateLimiter = dependencies.rateLimiter;

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
    await this.#rateLimiter?.acquire();
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
        response = await this.fetchWithTimeout(url, "GET", headers);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        if (error instanceof RailsApiRequestTimeoutError) {
          if (shouldRetry(attempt, this.#config.maxRetries)) {
            this.log("warn", "GET", request.path, request.requestId, attempt, "timeout_retry", durationMs);
            await this.#wait(retryDelayMs(attempt));
            continue;
          }

          this.log("warn", "GET", request.path, request.requestId, attempt, "timeout", durationMs);
          throw createRailsApiTimeoutError();
        }

        if (shouldRetry(attempt, this.#config.maxRetries)) {
          this.log("warn", "GET", request.path, request.requestId, attempt, "network_retry", durationMs);
          await this.#wait(retryDelayMs(attempt));
          continue;
        }

        this.log("warn", "GET", request.path, request.requestId, attempt, "network_error", durationMs);
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
        this.log("warn", "GET", request.path, request.requestId, attempt, String(response.status), durationMs);
        await this.#wait(retryDelayMs(attempt));
        continue;
      }

      if (!response.ok) {
        this.log("warn", "GET", request.path, request.requestId, attempt, String(response.status), durationMs);
        throw createRailsApiHttpError(response.status);
      }

      try {
        const parsed = await readJsonResponse(response, this.#config.maxResponseBytes);
        const validated = validateResponse(parsed, request.responseSchema);
        this.log("info", "GET", request.path, request.requestId, attempt, String(response.status), durationMs);
        return validated;
      } catch (error) {
        this.log("warn", "GET", request.path, request.requestId, attempt, "invalid_response", durationMs);
        throw error;
      }
    }
  }

  async post<TBody = unknown, TResponse = unknown>(
    request: RailsApiMutationRequest<TBody, TResponse>,
  ): Promise<TResponse> {
    return this.mutate({ ...request, method: "POST" });
  }

  async patch<TBody = unknown, TResponse = unknown>(
    request: RailsApiMutationRequest<TBody, TResponse>,
  ): Promise<TResponse> {
    return this.mutate({ ...request, method: "PATCH" });
  }

  async put<TBody = unknown, TResponse = unknown>(
    request: RailsApiMutationRequest<TBody, TResponse>,
  ): Promise<TResponse> {
    return this.mutate({ ...request, method: "PUT" });
  }

  async delete<TResponse = unknown>(
    request: RailsApiMutationRequest<never, TResponse>,
  ): Promise<TResponse> {
    return this.mutate({ ...request, method: "DELETE" });
  }

  async mutate<TBody = unknown, TResponse = unknown>(
    request: RailsApiMutationRequest<TBody, TResponse>,
  ): Promise<TResponse> {
    await this.#rateLimiter?.acquire();
    const method = request.method ?? "POST";
    const url = buildRelativeApiUrl(
      this.#config.baseUrl,
      request.path,
      request.query,
    );

    let bodyPayload: string | undefined;
    if (request.body !== undefined) {
      if (request.requestSchema) {
        const parsed = request.requestSchema.safeParse(request.body);
        if (!parsed.success) {
          throw new McpPlatformError({
            code: "RAILS_API_INVALID_PAYLOAD",
            message: "Mutation payload failed validation against request schema.",
            retryable: false,
          });
        }
        bodyPayload = JSON.stringify(parsed.data);
      } else {
        bodyPayload = JSON.stringify(request.body);
      }
    }

    const headers = createDefaultHeaders(this.#config, request.requestId, {
      idempotencyKey: request.idempotencyKey,
      hasBody: bodyPayload !== undefined,
    });

    const startedAt = Date.now();
    let response: Response;

    try {
      response = await this.fetchWithTimeout(url, method, headers, bodyPayload);
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      if (error instanceof RailsApiRequestTimeoutError) {
        this.log("warn", method, request.path, request.requestId, 0, "timeout", durationMs);
        throw createRailsApiTimeoutError();
      }

      this.log("warn", method, request.path, request.requestId, 0, "network_error", durationMs);
      throw createRailsApiNetworkError();
    }

    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      this.log("warn", method, request.path, request.requestId, 0, String(response.status), durationMs);
      throw createRailsApiHttpError(response.status);
    }

    if (response.status === 204) {
      this.log("info", method, request.path, request.requestId, 0, "204", durationMs);
      return undefined as TResponse;
    }

    try {
      const parsed = await readJsonResponse(response, this.#config.maxResponseBytes);
      const validated = validateResponse(parsed, request.responseSchema);
      this.log("info", method, request.path, request.requestId, 0, String(response.status), durationMs);
      return validated;
    } catch (error) {
      this.log("warn", method, request.path, request.requestId, 0, "invalid_response", durationMs);
      throw error;
    }
  }

  private async fetchWithTimeout(
    url: URL,
    method: "GET" | RailsApiMutationMethod,
    headers: Headers,
    body?: string,
  ): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#config.timeoutMs);

    try {
      const init: RequestInit = {
        method,
        headers,
        signal: controller.signal,
        redirect: "error",
      };
      if (body !== undefined) {
        init.body = body;
      }
      return await this.#fetch(url, init);
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
    method: string,
    path: string,
    requestId: string,
    attempt: number,
    status: string,
    durationMs: number,
  ): void {
    this.#logger?.[level](`Rails API ${method} request completed.`, {
      product: this.#config.productId,
      requestId,
      method,
      path,
      status,
      durationMs,
      attempt: attempt + 1,
    });
  }
}

class RailsApiRequestTimeoutError extends Error {}

