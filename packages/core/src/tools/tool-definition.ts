import type { z } from "zod";
import type { ToolExecutionContext } from "../context/tool-execution-context.js";

export interface ToolDefinition<
  TInputSchema extends z.ZodType = z.ZodType,
  TOutput = unknown,
> {
  readonly name: string;
  readonly description: string;
  readonly readOnly: boolean;
  readonly inputSchema: TInputSchema;
  execute(
    context: ToolExecutionContext,
    input: z.output<TInputSchema>,
  ): Promise<TOutput> | TOutput;
}
