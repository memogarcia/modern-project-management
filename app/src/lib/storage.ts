import type { Diagram } from "@/lib/types";

/**
 * Storage layer — reads / writes diagrams via the Next.js API routes,
 * which in turn read / write JSON files in the shared diagrams-data
 * directory (the same directory the MCP server uses).
 *
 * All public functions are async; callers must await them.
 */

const API_BASE = "/api/diagrams";

/** Fetch all diagrams (sorted newest-first by the API). */
export async function loadDiagrams(): Promise<Diagram[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return [];
    return (await res.json()) as Diagram[];
  } catch {
    return [];
  }
}

/** Fetch a single diagram by ID. */
export async function loadDiagram(id: string): Promise<Diagram | null> {
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Diagram;
  } catch {
    return null;
  }
}

/** Create or update a diagram (POST to the API, which writes the JSON file). */
export async function saveDiagram(diagram: Diagram): Promise<void> {
  await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...diagram,
      updatedAt: new Date().toISOString(),
    }),
  });
}

/** Delete a diagram by ID. */
export async function deleteDiagram(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
}
