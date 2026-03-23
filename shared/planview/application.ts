import { createEmptyDiagramDocument, createEmptyTroubleshootingSession } from "./domain.js";
import type { DiagramDocument, TroubleshootingSession } from "./domain.js";

export const DEFAULT_DIAGRAM_MERMAID_CODE = "graph TD\n";

export function createDiagramDraft(input: {
  id?: string;
  name: string;
  description?: string;
  mermaidCode?: string;
  createdAt?: string;
}): DiagramDocument {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return createEmptyDiagramDocument({
    id: input.id ?? crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    mermaidCode: input.mermaidCode ?? DEFAULT_DIAGRAM_MERMAID_CODE,
    createdAt,
  });
}

export function createTroubleshootingSessionDraft(input: {
  id?: string;
  diagramId: string;
  title: string;
  summary: string;
  createdAt?: string;
  updatedAt?: string;
  projectId?: string | null;
  systemScope?: string;
  status?: TroubleshootingSession["status"];
  linkedNodeIds?: string[];
  linkedEdgeIds?: string[];
  notesMarkdown?: string;
  hypotheses?: string[];
  aiTranscriptReferences?: TroubleshootingSession["aiTranscriptReferences"];
  resolutionSummary?: string;
}): Omit<TroubleshootingSession, "artifacts"> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return createEmptyTroubleshootingSession({
    id: input.id,
    diagramId: input.diagramId,
    projectId: input.projectId ?? null,
    systemScope: input.systemScope,
    title: input.title.trim(),
    summary: input.summary.trim(),
    status: input.status,
    linkedNodeIds: input.linkedNodeIds ?? [],
    linkedEdgeIds: input.linkedEdgeIds ?? [],
    notesMarkdown: input.notesMarkdown ?? "",
    hypotheses: input.hypotheses ?? [],
    aiTranscriptReferences: input.aiTranscriptReferences ?? [],
    resolutionSummary: input.resolutionSummary ?? "",
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  });
}
