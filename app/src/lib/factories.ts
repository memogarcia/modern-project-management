import type { Diagram, TroubleshootingSession } from "@/lib/types";
import {
  createDiagramDraft,
  createTroubleshootingSessionDraft,
} from "@planview/application";

export function createNewDiagram(input: {
  id?: string;
  name: string;
  description?: string;
  mermaidCode?: string;
  createdAt?: string;
}): Diagram {
  return createDiagramDraft(input) as Diagram;
}

export function createNewInvestigation(input: {
  id?: string;
  diagramId: string;
  title: string;
  summary: string;
  linkedNodeIds?: string[];
  linkedEdgeIds?: string[];
}): Omit<TroubleshootingSession, "artifacts"> {
  return createTroubleshootingSessionDraft({
    id: input.id,
    diagramId: input.diagramId,
    title: input.title,
    summary: input.summary,
    linkedNodeIds: input.linkedNodeIds,
    linkedEdgeIds: input.linkedEdgeIds,
  });
}
