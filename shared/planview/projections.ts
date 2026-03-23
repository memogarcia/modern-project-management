import type { DiagramSummary, KnowledgePattern, TroubleshootingSession } from "./domain.js";

export type DiagramResourceSummary = Pick<DiagramSummary, "id" | "name" | "description" | "updatedAt">;

export function toDiagramResourceSummary(diagram: DiagramResourceSummary): DiagramResourceSummary {
  return {
    id: diagram.id,
    name: diagram.name,
    description: diagram.description,
    updatedAt: diagram.updatedAt,
  };
}

export type TroubleshootingSessionResourceSummary = Pick<
  TroubleshootingSession,
  "id" | "diagramId" | "title" | "summary" | "status" | "updatedAt" | "linkedNodeIds" | "linkedEdgeIds"
>;

export function toTroubleshootingSessionResourceSummary(
  session: TroubleshootingSessionResourceSummary
): TroubleshootingSessionResourceSummary {
  return {
    id: session.id,
    diagramId: session.diagramId,
    title: session.title,
    summary: session.summary,
    status: session.status,
    updatedAt: session.updatedAt,
    linkedNodeIds: session.linkedNodeIds,
    linkedEdgeIds: session.linkedEdgeIds,
  };
}

export type ArtifactResourceSummary = {
  id: string;
  artifactId: string;
  ownerType: "node" | "edge" | "session";
  ownerId: string;
  diagramId?: string | null;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
};

export function toArtifactResourceSummary(artifact: ArtifactResourceSummary): ArtifactResourceSummary {
  return {
    id: artifact.id,
    artifactId: artifact.artifactId,
    ownerType: artifact.ownerType,
    ownerId: artifact.ownerId,
    diagramId: artifact.diagramId ?? null,
    label: artifact.label,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    sizeBytes: artifact.sizeBytes,
    checksumSha256: artifact.checksumSha256,
    createdAt: artifact.createdAt,
  };
}

export type KnowledgePatternResource = KnowledgePattern;
