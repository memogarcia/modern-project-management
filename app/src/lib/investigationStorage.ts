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

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) {
      return data.error;
    }
  } catch {
    // ignore
  }
  return `${response.status} ${response.statusText}`.trim();
}

export async function updateNodeMetadata(
  diagramId: string,
  nodeId: string,
  metadata: DiagramNodeMetadata,
  expectedRevision?: number
): Promise<void> {
  const response = await fetch(`/api/diagrams/${diagramId}/nodes/${nodeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata, expectedRevision }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function updateEdgeMetadata(
  diagramId: string,
  edgeId: string,
  metadata: DiagramEdgeMetadata,
  expectedRevision?: number
): Promise<void> {
  const response = await fetch(`/api/diagrams/${diagramId}/edges/${edgeId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metadata, expectedRevision }),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}

export async function listInvestigations(filters?: {
  diagramId?: string;
  nodeId?: string;
  edgeId?: string;
  q?: string;
}): Promise<TroubleshootingSession[]> {
  const searchParams = new URLSearchParams();
  if (filters?.diagramId) searchParams.set("diagramId", filters.diagramId);
  if (filters?.nodeId) searchParams.set("nodeId", filters.nodeId);
  if (filters?.edgeId) searchParams.set("edgeId", filters.edgeId);
  if (filters?.q) searchParams.set("q", filters.q);

  const response = await fetch(`/api/investigations?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TroubleshootingSession[];
}

export async function getInvestigation(id: string): Promise<TroubleshootingSession | null> {
  const response = await fetch(`/api/investigations/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TroubleshootingSession;
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
  const response = await fetch("/api/investigations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TroubleshootingSession;
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
  const response = await fetch(`/api/investigations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TroubleshootingSession;
}

export async function appendInvestigationTimelineEntry(
  id: string,
  entry: Omit<SessionTimelineEntry, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionTimelineEntry> {
  const response = await fetch(`/api/investigations/${id}/timeline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as SessionTimelineEntry;
}

export async function appendInvestigationComment(
  id: string,
  comment: Omit<SessionComment, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<SessionComment> {
  const response = await fetch(`/api/investigations/${id}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(comment),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as SessionComment;
}

export async function appendInvestigationCommand(
  id: string,
  command: Omit<SessionCommand, "id" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<SessionCommand> {
  const response = await fetch(`/api/investigations/${id}/commands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as SessionCommand;
}

export async function extractPattern(id: string, payload: {
  title: string;
  summary: string;
  symptom: string;
  resolution: string;
  tags: string[];
}): Promise<KnowledgePattern> {
  const response = await fetch(`/api/investigations/${id}/pattern`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as KnowledgePattern;
}

export async function listPatterns(): Promise<KnowledgePattern[]> {
  const response = await fetch("/api/patterns");
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as KnowledgePattern[];
}

export async function searchTroubleshootingMemory(query: {
  q: string;
  diagramId?: string;
  nodeId?: string;
  edgeId?: string;
  limit?: number;
}): Promise<TroubleshootingSearchHit[]> {
  const searchParams = new URLSearchParams({ q: query.q });
  if (query.diagramId) searchParams.set("diagramId", query.diagramId);
  if (query.nodeId) searchParams.set("nodeId", query.nodeId);
  if (query.edgeId) searchParams.set("edgeId", query.edgeId);
  if (query.limit) searchParams.set("limit", String(query.limit));
  const response = await fetch(`/api/search?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as TroubleshootingSearchHit[];
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

  const response = await fetch("/api/artifacts", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return (await response.json()) as ArtifactReference;
}
