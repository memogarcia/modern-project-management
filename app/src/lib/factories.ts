import type { Diagram, TroubleshootingSession } from "@/lib/types";
import { createEmptyDiagramDocument, createEmptyTroubleshootingSession } from "@planview/domain";

export function createNewDiagram(input: {
  id?: string;
  name: string;
  description?: string;
  mermaidCode?: string;
  createdAt?: string;
}): Diagram {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return createEmptyDiagramDocument({
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    mermaidCode: input.mermaidCode ?? "graph TD\n",
    createdAt,
  }) as Diagram;
}

export function createNewInvestigation(input: {
  id?: string;
  diagramId: string;
  title: string;
  summary: string;
  linkedNodeIds?: string[];
  linkedEdgeIds?: string[];
}): Omit<TroubleshootingSession, "artifacts"> {
  const now = new Date().toISOString();
  return createEmptyTroubleshootingSession({
    id: input.id,
    diagramId: input.diagramId,
    title: input.title.trim(),
    summary: input.summary.trim(),
    createdAt: now,
    linkedNodeIds: input.linkedNodeIds ?? [],
    linkedEdgeIds: input.linkedEdgeIds ?? [],
  });
}
