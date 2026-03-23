import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { asPlanViewError, PlanViewError } from "../../shared/planview/errors.js";

export type JsonToolResult = {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
};

type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
};

type JsonToolConfig = {
  title: string;
  description: string;
  inputSchema?: unknown;
  annotations?: ToolAnnotations;
};

type JsonToolHandler = (args: any) => Promise<JsonToolResult | unknown> | JsonToolResult | unknown;

export function toolSuccess(payload: unknown): JsonToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function toolError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): JsonToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, code, details }, null, 2),
      },
    ],
    isError: true,
  };
}

export function toolErrorFromUnknown(
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
) {
  const planViewError = asPlanViewError(error);
  if (planViewError.code === "internal_error" && fallbackCode !== "internal_error") {
    return toolError(fallbackCode, fallbackMessage, planViewError.details);
  }
  return toolError(planViewError.code, planViewError.message, planViewError.details);
}

export function requireToolValue<T>(
  value: T | null | undefined,
  code: string,
  message: string,
  details?: Record<string, unknown>
): T {
  if (value === null || value === undefined) {
    throw new PlanViewError(code, message, { status: 404, details });
  }
  return value;
}

export function abortTool(
  code: string,
  message: string,
  details?: Record<string, unknown>
): never {
  throw new PlanViewError(code, message, { status: 400, details });
}

export function assertFound<T>(
  value: T | null | undefined,
  code: string,
  message: string,
  details?: Record<string, unknown>
): T {
  return requireToolValue(value, code, message, details);
}

function isJsonToolResult(value: unknown): value is JsonToolResult {
  return Boolean(value) && typeof value === "object" && Array.isArray((value as JsonToolResult).content);
}

export function registerJsonTool(
  server: McpServer,
  name: string,
  config: JsonToolConfig,
  handler: JsonToolHandler,
  options?: {
    fallbackCode?: string;
    fallbackMessage?: string;
  }
): void {
  server.registerTool(name, config as any, async (args: any) => {
    try {
      const result = await handler(args);
      return isJsonToolResult(result) ? result : toolSuccess(result);
    } catch (error) {
      return toolErrorFromUnknown(
        error,
        options?.fallbackCode ?? "internal_error",
        options?.fallbackMessage ?? "Unknown error"
      );
    }
  });
}
