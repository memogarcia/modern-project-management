import type { Diagram, DiagramMeta, DiagramPerspective } from "@/lib/types";
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

  async listPerspectives(id: string): Promise<DiagramPerspective[]> {
    return requestJson<DiagramPerspective[]>(`${API_BASE}/${id}/perspectives`);
  },

  async savePerspective(id: string, perspective: DiagramPerspective): Promise<DiagramPerspective> {
    return postJson<DiagramPerspective>(`${API_BASE}/${id}/perspectives`, perspective);
  },

  async removePerspective(id: string, perspectiveId: string): Promise<void> {
    return requestVoid(`${API_BASE}/${id}/perspectives/${perspectiveId}`, { method: "DELETE" });
  },
};
