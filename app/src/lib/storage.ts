import type { Diagram, DiagramMeta } from "@/lib/types";
import { diagramClient } from "@/lib/diagramClient";

/** Fetch diagram summaries (sorted newest-first by the API). */
export async function loadDiagrams(): Promise<DiagramMeta[]> {
  try {
    return await diagramClient.list();
  } catch (error) {
    console.error("Failed to load diagrams", error);
    return [];
  }
}

/** Fetch a single diagram by ID. */
export async function loadDiagram(id: string): Promise<Diagram | null> {
  return diagramClient.get(id);
}

/** Create or update a diagram and return the persisted revision. */
export async function saveDiagram(diagram: Diagram & { expectedRevision?: number }): Promise<Diagram> {
  return diagramClient.save(diagram);
}

/** Delete a diagram by ID. */
export async function deleteDiagram(id: string): Promise<void> {
  return diagramClient.remove(id);
}
