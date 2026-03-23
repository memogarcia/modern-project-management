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

export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}
