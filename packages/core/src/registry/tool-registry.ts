import { z } from "zod";
import type { ToolExecutionContext } from "../context/tool-execution-context.js";
import { McpPlatformError } from "../errors/mcp-platform-error.js";
import type { ToolDefinition } from "../tools/tool-definition.js";

const toolNamePattern = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export class ToolRegistry {
  readonly #tools = new Map<string, ToolDefinition>();

  register<TInputSchema extends z.ZodType, TOutput>(
    tool: ToolDefinition<TInputSchema, TOutput>,
  ): void {
    this.validateTool(tool);

    if (this.#tools.has(tool.name)) {
      throw new McpPlatformError({
        code: "DUPLICATE_TOOL",
        message: "A tool with this name is already registered.",
      });
    }

    this.#tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  list(): readonly ToolDefinition[] {
    return [...this.#tools.values()].sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
  }

  async execute(
    name: string,
    rawInput: unknown,
    context: ToolExecutionContext,
  ): Promise<unknown> {
    const tool = this.get(name);
    if (tool === undefined) {
      throw new McpPlatformError({
        code: "TOOL_NOT_FOUND",
        message: "The requested tool is not registered.",
      });
    }

    const parsedInput = tool.inputSchema.safeParse(rawInput);
    if (!parsedInput.success) {
      throw new McpPlatformError({
        code: "INVALID_TOOL_INPUT",
        message: "Tool input did not match the required schema.",
      });
    }

    return tool.execute(context, parsedInput.data);
  }

  private validateTool(tool: ToolDefinition): void {
    if (tool === null || typeof tool !== "object") {
      throw new McpPlatformError({
        code: "INVALID_TOOL",
        message: "Tool definition is invalid.",
      });
    }

    if (typeof tool.name !== "string" || !toolNamePattern.test(tool.name)) {
      throw new McpPlatformError({
        code: "INVALID_TOOL_NAME",
        message: "Tool names must use lowercase letters, numbers, and single underscores.",
      });
    }

    if (typeof tool.description !== "string" || tool.description.trim() === "") {
      throw new McpPlatformError({
        code: "INVALID_TOOL_DESCRIPTION",
        message: "Tool descriptions must not be empty.",
      });
    }

    if (!(tool.inputSchema instanceof z.ZodType)) {
      throw new McpPlatformError({
        code: "INVALID_TOOL_SCHEMA",
        message: "Tool input schema is required.",
      });
    }

    if (tool.readOnly !== true) {
      throw new McpPlatformError({
        code: "MUTATION_NOT_ALLOWED",
        message: "Only read-only tools may be registered in V1.",
      });
    }

    if (typeof tool.execute !== "function") {
      throw new McpPlatformError({
        code: "INVALID_TOOL_EXECUTOR",
        message: "Tool execution handler is required.",
      });
    }
  }
}
