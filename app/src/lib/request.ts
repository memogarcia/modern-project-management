type QueryValue = string | number | boolean | undefined | null;
type QueryParams = Record<string, QueryValue>;
type QueryParser<T> = (value: string | null) => T;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) {
      return data.error;
    }
  } catch {
    // Ignore JSON parse failures and fall back to status text.
  }

  return `${response.status} ${response.statusText}`.trim();
}

export function jsonRequestInit(body: unknown, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return {
    ...init,
    headers,
    body: JSON.stringify(body),
  };
}

export async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

export async function requestOptionalJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T | null> {
  const response = await fetch(input, init);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

export async function requestVoid(input: RequestInfo | URL, init?: RequestInit): Promise<void> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function postJson<TResponse>(
  input: RequestInfo | URL,
  body: unknown,
  init?: Omit<RequestInit, "body" | "method">
): Promise<TResponse> {
  return requestJson<TResponse>(input, jsonRequestInit(body, { ...init, method: "POST" }));
}

export async function patchJson<TResponse>(
  input: RequestInfo | URL,
  body: unknown,
  init?: Omit<RequestInit, "body" | "method">
): Promise<TResponse> {
  return requestJson<TResponse>(input, jsonRequestInit(body, { ...init, method: "PATCH" }));
}

export async function patchVoid(
  input: RequestInfo | URL,
  body: unknown,
  init?: Omit<RequestInit, "body" | "method">
): Promise<void> {
  return requestVoid(input, jsonRequestInit(body, { ...init, method: "PATCH" }));
}

export function buildQueryString(params: QueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function parseQueryParams<TShape extends Record<string, QueryParser<unknown>>>(
  request: Request,
  shape: TShape
): { [K in keyof TShape]: ReturnType<TShape[K]> } {
  const { searchParams } = new URL(request.url);
  const entries = Object.entries(shape).map(([key, parser]) => [
    key,
    parser(searchParams.get(key)),
  ]);
  return Object.fromEntries(entries) as { [K in keyof TShape]: ReturnType<TShape[K]> };
}

export function parseOptionalString(value: string | null): string | undefined {
  return value && value.length > 0 ? value : undefined;
}

export function parseRequiredString(value: string | null, fallback = ""): string {
  return value ?? fallback;
}

export function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
