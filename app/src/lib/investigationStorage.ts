import type {
  ArtifactReference,
  DiagramEdgeMetadata,
  DiagramNodeMetadata,
  KnowledgePattern,
  SessionCommand,
  SessionComment,
  SessionTimelineEntry,
  TroubleshootingSearchHit,
  TroubleshootingSession,
} from "@/lib/types";
import { investigationClient } from "@/lib/investigationClient";
import type {
  InvestigationListFilters,
  TroubleshootingMemoryQuery,
} from "@/lib/investigationQueries";

export type CreateInvestigationInput = Parameters<typeof investigationClient.create>[0];

export async function updateNodeMetadata(
  diagramId: string,
  nodeId: string,
  metadata: DiagramNodeMetadata,
  expectedRevision?: number
): Promise<void> {
  return investigationClient.updateNodeMetadata(diagramId, nodeId, metadata, expectedRevision);
}

export async function updateEdgeMetadata(
  diagramId: string,
  edgeId: string,
  metadata: DiagramEdgeMetadata,
  expectedRevision?: number
): Promise<void> {
  return investigationClient.updateEdgeMetadata(diagramId, edgeId, metadata, expectedRevision);
}

export async function listInvestigations(
  filters?: InvestigationListFilters
): Promise<TroubleshootingSession[]> {
  return investigationClient.list(filters);
}

export async function getInvestigation(id: string): Promise<TroubleshootingSession | null> {
  return investigationClient.get(id);
}

export async function createInvestigation(
  payload: CreateInvestigationInput
): Promise<TroubleshootingSession> {
  return investigationClient.create(payload);
}

export async function patchInvestigation(
  id: string,
  patch: Partial<
    Pick<
      TroubleshootingSession,
      | "title"
      | "summary"
      | "status"
      | "linkedNodeIds"
      | "linkedEdgeIds"
      | "notesMarkdown"
      | "hypotheses"
      | "aiTranscriptReferences"
      | "resolutionSummary"
    >
  >
): Promise<TroubleshootingSession> {
  return investigationClient.patch(id, patch);
}

export async function appendInvestigationTimelineEntry(
  id: string,
  entry: Omit<SessionTimelineEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionTimelineEntry> {
  return investigationClient.appendTimelineEntry(id, entry);
}

export async function appendInvestigationComment(
  id: string,
  comment: Omit<SessionComment, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<SessionComment> {
  return investigationClient.appendComment(id, comment);
}

export async function appendInvestigationCommand(
  id: string,
  command: Omit<SessionCommand, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionCommand> {
  return investigationClient.appendCommand(id, command);
}

export async function extractPattern(
  id: string,
  payload: {
    title: string;
    summary: string;
    symptom: string;
    resolution: string;
    tags: string[];
  }
): Promise<KnowledgePattern> {
  return investigationClient.extractPattern(id, payload);
}

export async function listPatterns(): Promise<KnowledgePattern[]> {
  return investigationClient.listPatterns();
}

export async function searchTroubleshootingMemory(
  query: TroubleshootingMemoryQuery
): Promise<TroubleshootingSearchHit[]> {
  return investigationClient.searchMemory(query);
}

export async function uploadArtifact(payload: {
  ownerType: "node" | "edge" | "session";
  diagramId?: string;
  ownerId: string;
  label?: string;
  file: File;
}): Promise<ArtifactReference> {
  return investigationClient.uploadArtifact(payload);
}
