import type { Diagram, DiagramMeta } from "@/lib/types";
import { postJson, requestJson, requestOptionalJson, requestVoid } from "@/lib/request";

const API_BASE = "/api/diagrams";

export const diagramClient = {
  async list(): Promise<DiagramMeta[]> {
    return requestJson<DiagramMeta[]>(API_BASE);
  },

  async get(id: string): Promise<Diagram | null> {
    return requestOptionalJson<Diagram>(`${API_BASE}/${id}`);
  },

  async save(diagram: Diagram & { expectedRevision?: number }): Promise<Diagram> {
    return postJson<Diagram>(API_BASE, diagram);
  },

  async remove(id: string): Promise<void> {
    return requestVoid(`${API_BASE}/${id}`, { method: "DELETE" });
  },
};
