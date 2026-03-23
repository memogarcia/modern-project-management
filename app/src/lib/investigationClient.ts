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
import {
  buildInvestigationListQuery,
  buildTroubleshootingMemoryQuery,
  type InvestigationListFilters,
  type TroubleshootingMemoryQuery,
} from "@/lib/investigationQueries";
import {
  patchJson,
  patchVoid,
  postJson,
  requestJson,
  requestOptionalJson,
  requestVoid,
} from "@/lib/request";

const INVESTIGATIONS_API_BASE = "/api/investigations";

export const investigationClient = {
  updateNodeMetadata(
    diagramId: string,
    nodeId: string,
    metadata: DiagramNodeMetadata,
    expectedRevision?: number
  ): Promise<void> {
    return patchVoid(`/api/diagrams/${diagramId}/nodes/${nodeId}`, { metadata, expectedRevision });
  },

  updateEdgeMetadata(
    diagramId: string,
    edgeId: string,
    metadata: DiagramEdgeMetadata,
    expectedRevision?: number
  ): Promise<void> {
    return patchVoid(`/api/diagrams/${diagramId}/edges/${edgeId}`, { metadata, expectedRevision });
  },

  list(filters?: InvestigationListFilters): Promise<TroubleshootingSession[]> {
    return requestJson<TroubleshootingSession[]>(
      `${INVESTIGATIONS_API_BASE}${buildInvestigationListQuery(filters)}`
    );
  },

  get(id: string): Promise<TroubleshootingSession | null> {
    return requestOptionalJson<TroubleshootingSession>(`${INVESTIGATIONS_API_BASE}/${id}`);
  },

  create(
    payload: Omit<
      TroubleshootingSession,
      "timelineEntries" | "commands" | "comments" | "artifacts" | "createdAt" | "updatedAt"
    > & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<TroubleshootingSession> {
    return postJson<TroubleshootingSession>(INVESTIGATIONS_API_BASE, payload);
  },

  patch(
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
    return patchJson<TroubleshootingSession>(`${INVESTIGATIONS_API_BASE}/${id}`, patch);
  },

  appendTimelineEntry(
    id: string,
    entry: Omit<SessionTimelineEntry, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    }
  ): Promise<SessionTimelineEntry> {
    return postJson<SessionTimelineEntry>(`${INVESTIGATIONS_API_BASE}/${id}/timeline`, entry);
  },

  appendComment(
    id: string,
    comment: Omit<SessionComment, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
      createdAt?: string;
      updatedAt?: string;
    }
  ): Promise<SessionComment> {
    return postJson<SessionComment>(`${INVESTIGATIONS_API_BASE}/${id}/comments`, comment);
  },

  appendCommand(
    id: string,
    command: Omit<SessionCommand, "id" | "createdAt"> & {
      id?: string;
      createdAt?: string;
    }
  ): Promise<SessionCommand> {
    return postJson<SessionCommand>(`${INVESTIGATIONS_API_BASE}/${id}/commands`, command);
  },

  extractPattern(
    id: string,
    payload: {
      title: string;
      summary: string;
      symptom: string;
      resolution: string;
      tags: string[];
    }
  ): Promise<KnowledgePattern> {
    return postJson<KnowledgePattern>(`${INVESTIGATIONS_API_BASE}/${id}/pattern`, payload);
  },

  listPatterns(): Promise<KnowledgePattern[]> {
    return requestJson<KnowledgePattern[]>("/api/patterns");
  },

  searchMemory(query: TroubleshootingMemoryQuery): Promise<TroubleshootingSearchHit[]> {
    return requestJson<TroubleshootingSearchHit[]>(
      `/api/search${buildTroubleshootingMemoryQuery(query)}`
    );
  },

  async uploadArtifact(payload: {
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
  },
};
