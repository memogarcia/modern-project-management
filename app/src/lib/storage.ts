import type { Diagram, DiagramMeta } from "@/lib/types";

/**
 * Diagram storage client used by the editor and diagram list pages.
 */

const API_BASE = "/api/diagrams";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`.trim();
}

/** Fetch diagram summaries (sorted newest-first by the API). */
export async function loadDiagrams(): Promise<DiagramMeta[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      console.error(`Failed to load diagrams: ${await readErrorMessage(res)}`);
      return [];
    }
    return (await res.json()) as DiagramMeta[];
  } catch (error) {
    console.error("Failed to load diagrams", error);
    return [];
  }
}

/** Fetch a single diagram by ID. */
export async function loadDiagram(id: string): Promise<Diagram | null> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as Diagram;
}

/** Create or update a diagram and return the persisted revision. */
export async function saveDiagram(diagram: Diagram & { expectedRevision?: number }): Promise<Diagram> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...diagram,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save diagram: ${await readErrorMessage(res)}`);
  }
  return (await res.json()) as Diagram;
}

/** Delete a diagram by ID. */
export async function deleteDiagram(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete diagram: ${await readErrorMessage(res)}`);
  }
}
