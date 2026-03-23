import type {
  Diagram,
} from "./types.js";
import {
  closePlanViewDb,
  createPlanViewTroubleshootingSession,
  deletePlanViewDiagram,
  extractPlanViewKnowledgePattern,
  getPlanViewDb as getDb,
  getPlanViewDiagramById,
  getPlanViewTroubleshootingSessionById,
  getPlanViewKnowledgePatternById as getPlanViewKnowledgePatternByIdShared,
  listPlanViewDiagrams,
  listPlanViewKnowledgePatterns,
  listPlanViewTroubleshootingSessions,
  listPlanViewArtifacts,
  savePlanViewArtifactFile,
  savePlanViewDiagram,
  searchPlanViewTroubleshootingMemory,
  updatePlanViewEdgeMetadata,
  updatePlanViewNodeMetadata,
  updatePlanViewTroubleshootingSession,
  getPlanViewArtifactById,
  appendPlanViewSessionComment,
  appendPlanViewSessionCommand,
  appendPlanViewTimelineEntry,
} from "../../shared/planview/database.js";

export { getPlanViewDb as getDb, closePlanViewDb as closeDb } from "../../shared/planview/database.js";

// ─── Diagram CRUD ────────────────────────────────────────────────────

export function listDiagrams(): Diagram[] {
  const db = getDb();
  return listPlanViewDiagrams(db)
    .map((diagram) => getPlanViewDiagramById(diagram.id, db))
    .filter((diagram): diagram is Diagram => Boolean(diagram));
}

export function getDiagramById(id: string): Diagram | null {
  return getPlanViewDiagramById(id, getDb()) as Diagram | null;
}

export function upsertDiagram(diagram: Diagram & { expectedRevision?: number }): Diagram {
  return savePlanViewDiagram(diagram, getDb()) as Diagram;
}

export function deleteDiagram(id: string): boolean {
  return deletePlanViewDiagram(id, getDb());
}

export const updateDiagramNodeDetails = updatePlanViewNodeMetadata;
export const updateDiagramEdgeDetails = updatePlanViewEdgeMetadata;
export const listTroubleshootingSessions = listPlanViewTroubleshootingSessions;
export const getTroubleshootingSessionById = getPlanViewTroubleshootingSessionById;
export const getPlanViewKnowledgePatternById = getPlanViewKnowledgePatternByIdShared;
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
