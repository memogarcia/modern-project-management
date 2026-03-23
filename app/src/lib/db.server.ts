import type { Diagram, DiagramMeta } from "./types";
import {
  deletePlanViewDiagram,
  extractPlanViewKnowledgePattern,
  getPlanViewDb as getDb,
  getPlanViewDiagramById,
  getPlanViewTroubleshootingSessionById,
  listPlanViewKnowledgePatterns,
  listPlanViewDiagrams,
  listPlanViewTroubleshootingSessions,
  listPlanViewArtifacts,
  savePlanViewArtifactFile,
  savePlanViewDiagram,
  searchPlanViewTroubleshootingMemory,
  updatePlanViewEdgeMetadata,
  updatePlanViewNodeMetadata,
  updatePlanViewTroubleshootingSession,
  getPlanViewArtifactById,
  createPlanViewTroubleshootingSession,
  appendPlanViewSessionComment,
  appendPlanViewSessionCommand,
  appendPlanViewTimelineEntry,
} from "@planview/database";

// ─── Diagram CRUD ────────────────────────────────────────────────────

export function listDiagrams(): DiagramMeta[] {
  return listPlanViewDiagrams(getDb()) as DiagramMeta[];
}

export function getDiagramById(id: string): Diagram | null {
  return getPlanViewDiagramById(id, getDb()) as Diagram | null;
}

export function upsertDiagram(
  diagram: Diagram & { expectedRevision?: number }
): Diagram {
  return savePlanViewDiagram(diagram as never, getDb()) as Diagram;
}

export function deleteDiagram(id: string): boolean {
  return deletePlanViewDiagram(id, getDb());
}

export const updateDiagramNodeDetails = updatePlanViewNodeMetadata;
export const updateDiagramEdgeDetails = updatePlanViewEdgeMetadata;
export const listTroubleshootingSessions = listPlanViewTroubleshootingSessions;
export const getTroubleshootingSessionById = getPlanViewTroubleshootingSessionById;
export const createTroubleshootingSession = createPlanViewTroubleshootingSession;
export const updateTroubleshootingSession = updatePlanViewTroubleshootingSession;
export const appendSessionTimelineEntry = appendPlanViewTimelineEntry;
export const appendSessionComment = appendPlanViewSessionComment;
export const appendSessionCommand = appendPlanViewSessionCommand;
export const extractKnowledgePattern = extractPlanViewKnowledgePattern;
export const listKnowledgePatterns = listPlanViewKnowledgePatterns;
export const searchTroubleshootingMemory = searchPlanViewTroubleshootingMemory;
export const saveArtifactFile = savePlanViewArtifactFile;
export const listArtifacts = listPlanViewArtifacts;
export const getArtifactById = getPlanViewArtifactById;
