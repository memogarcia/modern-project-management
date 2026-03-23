import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type output as ZodOutput } from "zod";
import { asPlanViewError, PlanViewError } from "@planview/errors";
import { SAFE_ENTITY_ID_RE } from "@planview/validation";

export async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema
): Promise<ZodOutput<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new PlanViewError("invalid_json", "Request body must be valid JSON.", {
      status: 400,
    });
  }

  return schema.parse(body);
}

export function parseSearchParams<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
  select: (searchParams: URLSearchParams) => unknown
): ZodOutput<TSchema> {
  const { searchParams } = new URL(request.url);
  return schema.parse(select(searchParams));
}

export function assertSafeEntityId(id: string, label: string): void {
  if (!SAFE_ENTITY_ID_RE.test(id)) {
    throw new PlanViewError("invalid_entity_id", `Invalid ${label}`, { status: 400 });
  }
}

export function assertSafeEntityIds(entries: Array<{ id: string; label: string }>): void {
  for (const entry of entries) {
    assertSafeEntityId(entry.id, entry.label);
  }
}

export async function withApiErrorHandling(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function jsonRoute<T>(
  handler: () => Promise<T | Response>,
  init?: ResponseInit
): Promise<Response> {
  return withApiErrorHandling(async () => {
    const result = await handler();
    return result instanceof Response ? result : NextResponse.json(result, init);
  });
}

export async function parseRouteParams<T extends Record<string, string>>(
  params: Promise<T>,
  entries: Array<{ key: keyof T; label: string }>
): Promise<T> {
  const resolved = await params;
  assertSafeEntityIds(
    entries.map((entry) => ({
      id: resolved[entry.key],
      label: entry.label,
    }))
  );
  return resolved;
}

export function jsonNotFound(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function jsonErrorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Request validation failed.",
        code: "validation_error",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  const planViewError = asPlanViewError(error);
  return NextResponse.json(
    {
      error: planViewError.message,
      code: planViewError.code,
      details: planViewError.details,
    },
    { status: planViewError.status }
  );
}
