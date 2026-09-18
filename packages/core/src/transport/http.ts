import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import type { Logger } from "../logging/logger.js";
import { executeToolCall, type ToolCallExecutionResult } from "../server/create-mcp-server.js";
import type { McpConfig } from "../config/config-schema.js";
import type { ToolRegistry } from "../registry/tool-registry.js";
import type { AuditSink } from "../audit/audit-sink.js";
import { ConsoleAuditSink } from "../audit/console-audit-sink.js";
import type { MetricsCollector } from "../metrics.js";

export interface CreateHttpServerOptions {
  readonly config: McpConfig;
  readonly registry: ToolRegistry;
  readonly logger: Logger;
  readonly auditSink?: AuditSink;
  readonly metrics?: MetricsCollector;
  /** Optional bearer token required to connect to the HTTP transport */
  readonly authToken?: string;
  /** Allowed origins for CORS (default: * or restricted list) */
  readonly allowedOrigins?: readonly string[];
  readonly port?: number;
  readonly host?: string;
}

export interface HttpServerInstance {
  readonly server: Server;
  readonly port: number;
  readonly host: string;
  listen(): Promise<{ port: number; host: string }>;
  close(): Promise<void>;
}

interface SseSession {
  readonly id: string;
  readonly response: ServerResponse;
  readonly createdAt: number;
}

export function createHttpServer(options: CreateHttpServerOptions): HttpServerInstance {
  const sessions = new Map<string, SseSession>();
  const host = options.host ?? "127.0.0.1";
  let boundPort = options.port ?? 0;
  const auditSink = options.auditSink ?? new ConsoleAuditSink();

  function setCorsHeaders(req: IncomingMessage, res: ServerResponse): boolean {
    const origin = req.headers.origin;
    if (options.allowedOrigins && options.allowedOrigins.length > 0) {
      if (origin && options.allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
      } else if (origin) {
        // Disallowed origin
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "CORS origin rejected" }));
        return false;
      }
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-MCP-Auth-Token");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return false;
    }
    return true;
  }

  function authenticate(req: IncomingMessage, res: ServerResponse): boolean {
    if (!options.authToken) {
      return true;
    }

    const authHeader = req.headers.authorization ?? req.headers["x-mcp-auth-token"];
    const token = typeof authHeader === "string" ? authHeader.replace(/^Bearer\s+/i, "").trim() : "";

    if (token !== options.authToken) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized: Invalid or missing transport authentication token." }));
      return false;
    }
    return true;
  }

  const server = createServer(async (req, res) => {
    if (!setCorsHeaders(req, res)) return;

    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
    const pathname = url.pathname;

    if (req.method === "GET" && pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", product: options.config.productId }));
      return;
    }

    if (req.method === "GET" && pathname === "/metrics") {
      if (!authenticate(req, res)) return;
      const summary = options.metrics?.getSummary() ?? { totalExecutions: 0 };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(summary));
      return;
    }

    // SSE Handshake
    if (req.method === "GET" && pathname === "/sse") {
      if (!authenticate(req, res)) return;

      const sessionId = randomUUID();
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      const session: SseSession = {
        id: sessionId,
        response: res,
        createdAt: Date.now(),
      };
      sessions.set(sessionId, session);

      res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

      req.on("close", () => {
        sessions.delete(sessionId);
      });
      return;
    }

    // POST messages / JSON-RPC tool calls
    if (req.method === "POST" && (pathname === "/messages" || pathname === "/rpc")) {
      if (!authenticate(req, res)) return;

      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const startedAt = Date.now();

          if (parsed.method === "tools/call" || parsed.toolName) {
            const toolName = parsed.params?.name ?? parsed.toolName;
            const toolArgs = parsed.params?.arguments ?? parsed.arguments ?? {};

            const result: ToolCallExecutionResult = await executeToolCall({
              config: options.config,
              registry: options.registry,
              logger: options.logger,
              auditSink,
              toolName,
              rawInput: toolArgs,
            });

            const durationMs = Date.now() - startedAt;
            options.metrics?.record({
              toolName,
              durationMs,
              success: !result.isError,
              ...(result.isError ? { errorCode: "TOOL_EXECUTION_ERROR" } : {}),
            });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: parsed.id ?? randomUUID(),
                result: {
                  content: [{ type: "text", text: result.text }],
                  isError: result.isError,
                },
              }),
            );
            return;
          }

          if (parsed.method === "tools/list") {
            const list = options.registry.list().map((t) => ({
              name: t.name,
              description: t.description,
              readOnly: t.readOnly,
              riskLevel: t.riskLevel,
            }));

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                jsonrpc: "2.0",
                id: parsed.id ?? randomUUID(),
                result: { tools: list },
              }),
            );
            return;
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              jsonrpc: "2.0",
              id: parsed.id ?? randomUUID(),
              result: { acknowledged: true },
            }),
          );
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON payload" }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  return {
    server,
    get port() {
      return boundPort;
    },
    get host() {
      return host;
    },
    listen(): Promise<{ port: number; host: string }> {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(boundPort, host, () => {
          server.off("error", reject);
          const addr = server.address();
          if (addr && typeof addr !== "string") {
            boundPort = addr.port;
          }
          options.logger.info("MCP Streamable HTTP server listening.", {
            product: options.config.productId,
            port: boundPort,
            host,
          });
          resolve({ port: boundPort, host });
        });
      });
    },
    close(): Promise<void> {
      for (const [, session] of sessions) {
        try {
          session.response.end();
        } catch {
          // ignore
        }
      }
      sessions.clear();
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
