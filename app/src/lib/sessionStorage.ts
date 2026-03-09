import type { Session } from "@/lib/sessionTypes";

const API_BASE = "/api/sessions";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`.trim();
}

export async function loadSessions(): Promise<Session[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      console.error(`Failed to load sessions: ${await readErrorMessage(res)}`);
      return [];
    }
    return (await res.json()) as Session[];
  } catch (error) {
    console.error("Failed to load sessions", error);
    return [];
  }
}

export async function loadSession(id: string): Promise<Session | null> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as Session;
}

export async function saveSession(session: Session): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...session,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save session: ${await readErrorMessage(res)}`);
  }
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete session: ${await readErrorMessage(res)}`);
  }
}
