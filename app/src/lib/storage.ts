import type { Diagram, DiagramMeta } from "@/lib/types";
import { requestJson, requestOptionalJson, requestVoid } from "@/lib/request";

/**
 * Diagram storage client used by the editor and diagram list pages.
 */

const API_BASE = "/api/diagrams";

/** Fetch diagram summaries (sorted newest-first by the API). */
export async function loadDiagrams(): Promise<DiagramMeta[]> {
  try {
    return await requestJson<DiagramMeta[]>(API_BASE);
  } catch (error) {
    console.error("Failed to load diagrams", error);
    return [];
  }
}

/** Fetch a single diagram by ID. */
export async function loadDiagram(id: string): Promise<Diagram | null> {
  return requestOptionalJson<Diagram>(`${API_BASE}/${id}`);
}

/** Create or update a diagram and return the persisted revision. */
export async function saveDiagram(diagram: Diagram & { expectedRevision?: number }): Promise<Diagram> {
  return requestJson<Diagram>(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(diagram),
  });
}

/** Delete a diagram by ID. */
export async function deleteDiagram(id: string): Promise<void> {
  return requestVoid(`${API_BASE}/${id}`, { method: "DELETE" });
}
