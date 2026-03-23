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
import { buildQueryString, requestJson, requestOptionalJson, requestVoid } from "@/lib/request";

export async function updateNodeMetadata(
  diagramId: string,
  nodeId: string,
  metadata: DiagramNodeMetadata,
  expectedRevision?: number
): Promise<void> {
  return requestVoid(`/api/diagrams/${diagramId}/nodes/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata, expectedRevision }),
  });
}

export async function updateEdgeMetadata(
  diagramId: string,
  edgeId: string,
  metadata: DiagramEdgeMetadata,
  expectedRevision?: number
): Promise<void> {
  return requestVoid(`/api/diagrams/${diagramId}/edges/${edgeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata, expectedRevision }),
  });
}

export async function listInvestigations(filters?: {
  diagramId?: string;
  nodeId?: string;
  edgeId?: string;
  q?: string;
}): Promise<TroubleshootingSession[]> {
  return requestJson<TroubleshootingSession[]>(
    `/api/investigations${buildQueryString({
      diagramId: filters?.diagramId,
      nodeId: filters?.nodeId,
      edgeId: filters?.edgeId,
      q: filters?.q,
    })}`
  );
}

export async function getInvestigation(id: string): Promise<TroubleshootingSession | null> {
  return requestOptionalJson<TroubleshootingSession>(`/api/investigations/${id}`);
}

export async function createInvestigation(
  payload: Omit<
    TroubleshootingSession,
    "timelineEntries" | "commands" | "comments" | "artifacts" | "createdAt" | "updatedAt"
  > & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<TroubleshootingSession> {
  return requestJson<TroubleshootingSession>("/api/investigations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
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
  return requestJson<TroubleshootingSession>(`/api/investigations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function appendInvestigationTimelineEntry(
  id: string,
  entry: Omit<SessionTimelineEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionTimelineEntry> {
  return requestJson<SessionTimelineEntry>(`/api/investigations/${id}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function appendInvestigationComment(
  id: string,
  comment: Omit<SessionComment, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<SessionComment> {
  return requestJson<SessionComment>(`/api/investigations/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment),
  });
}

export async function appendInvestigationCommand(
  id: string,
  command: Omit<SessionCommand, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionCommand> {
  return requestJson<SessionCommand>(`/api/investigations/${id}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
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
  return requestJson<KnowledgePattern>(`/api/investigations/${id}/pattern`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function listPatterns(): Promise<KnowledgePattern[]> {
  return requestJson<KnowledgePattern[]>("/api/patterns");
}

export async function searchTroubleshootingMemory(query: {
  q: string;
  diagramId?: string;
  nodeId?: string;
  edgeId?: string;
  limit?: number;
}): Promise<TroubleshootingSearchHit[]> {
  return requestJson<TroubleshootingSearchHit[]>(
    `/api/search${buildQueryString({
      q: query.q,
      diagramId: query.diagramId,
      nodeId: query.nodeId,
      edgeId: query.edgeId,
      limit: query.limit,
    })}`
  );
}

export async function uploadArtifact(payload: {
  ownerType: "node" | "edge" | "session";
  diagramId?: string;
  ownerId: string;
  label?: string;
  file: File;
}): Promise<ArtifactReference> {
  const formData = new FormData();
  formData.set("ownerType", payload.ownerType);
  if (payload.diagramId) formData.set("diagramId", payload.diagramId);
  formData.set("ownerId", payload.ownerId);
  if (payload.label) formData.set("label", payload.label);
  formData.set("file", payload.file);

  return requestJson<ArtifactReference>("/api/artifacts", {
    method: "POST",
    body: formData,
  });
}
