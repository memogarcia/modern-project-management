import { z } from "zod";
import {
  LINK_KINDS,
  SESSION_COMMAND_STATUSES,
  SESSION_STATUSES,
  TIMELINE_ENTRY_KINDS,
} from "./domain.js";

export const SAFE_ENTITY_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const safeIdSchema = z
  .string()
  .trim()
  .regex(SAFE_ENTITY_ID_RE, "IDs must use only letters, numbers, underscores, and hyphens.");

const linkReferenceSchema = z.object({
  id: z.string().trim().min(1).max(256),
  label: z.string().trim().min(1).max(256),
  url: z.string().trim().url(),
  kind: z.enum(LINK_KINDS),
});

const artifactReferenceSchema = z.object({
  id: z.string().trim().min(1).max(256),
  artifactId: z.string().trim().min(1).max(256),
  label: z.string().trim().min(1).max(256),
  fileName: z.string().trim().min(1).max(512),
  relativePath: z.string().trim().min(1).max(2048),
  mimeType: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string().trim().min(1).max(128),
  createdAt: z.string().trim().datetime(),
});

export const nodeMetadataSchema = z.object({
  title: z.string().trim().min(1).max(256),
  description: z.string().max(20000).default(""),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  owner: z.string().trim().max(256).default(""),
  documentationLinks: z.array(linkReferenceSchema).max(100).default([]),
  dashboardLinks: z.array(linkReferenceSchema).max(100).default([]),
  logLinks: z.array(linkReferenceSchema).max(100).default([]),
  traceLinks: z.array(linkReferenceSchema).max(100).default([]),
  runbookLinks: z.array(linkReferenceSchema).max(100).default([]),
  knownFailureModes: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  notesMarkdown: z.string().max(100000).default(""),
  attachments: z.array(artifactReferenceSchema).max(200).default([]),
  createdAt: z.string().trim().datetime(),
  updatedAt: z.string().trim().datetime(),
  lastVerifiedAt: z.string().trim().datetime().optional(),
});

export const edgeMetadataSchema = z.object({
  relationshipType: z.string().trim().max(256).default(""),
  protocol: z.string().trim().max(256).default(""),
  authAssumptions: z.string().max(10000).default(""),
  dependencyNotes: z.string().max(20000).default(""),
  knownFailureModes: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  evidenceReferences: z.array(linkReferenceSchema).max(100).default([]),
  notesMarkdown: z.string().max(100000).default(""),
  commentsMarkdown: z.string().max(100000).default(""),
  createdAt: z.string().trim().datetime(),
  updatedAt: z.string().trim().datetime(),
});

export const diagramUpsertSchema = z.object({
  id: safeIdSchema,
  projectId: safeIdSchema.nullish(),
  name: z.string().trim().min(1).max(256),
  description: z.string().max(10000).default(""),
  mermaidCode: z.string().max(200000).default("graph TD\n"),
  nodes: z.array(z.record(z.string(), z.unknown())).max(5000),
  edges: z.array(z.record(z.string(), z.unknown())).max(5000),
  createdAt: z.string().trim().datetime(),
  updatedAt: z.string().trim().datetime().optional(),
  revision: z.number().int().positive().optional(),
  expectedRevision: z.number().int().positive().optional(),
});

export const diagramNodeMetadataPatchSchema = z.object({
  metadata: nodeMetadataSchema,
  expectedRevision: z.number().int().positive().optional(),
});

export const diagramEdgeMetadataPatchSchema = z.object({
  metadata: edgeMetadataSchema,
  expectedRevision: z.number().int().positive().optional(),
});

export const timelineEntrySchema = z.object({
  id: safeIdSchema.optional(),
  kind: z.enum(TIMELINE_ENTRY_KINDS),
  title: z.string().trim().min(1).max(256),
  body: z.string().max(50000).default(""),
  author: z.string().trim().max(256).default(""),
  occurredAt: z.string().trim().datetime(),
  createdAt: z.string().trim().datetime().optional(),
});

export const sessionCommentSchema = z.object({
  id: safeIdSchema.optional(),
  author: z.string().trim().min(1).max(256),
  body: z.string().trim().min(1).max(50000),
  createdAt: z.string().trim().datetime().optional(),
  updatedAt: z.string().trim().datetime().optional(),
});

export const sessionCommandSchema = z.object({
  id: safeIdSchema.optional(),
  command: z.string().trim().min(1).max(10000),
  summary: z.string().max(10000).default(""),
  outputExcerpt: z.string().max(50000).default(""),
  status: z.enum(SESSION_COMMAND_STATUSES).default("ran"),
  createdAt: z.string().trim().datetime().optional(),
});

export const troubleshootingSessionCreateSchema = z.object({
  id: safeIdSchema.optional(),
  diagramId: safeIdSchema,
  projectId: safeIdSchema.nullish(),
  systemScope: z.string().trim().max(512).optional(),
  title: z.string().trim().min(1).max(256),
  summary: z.string().trim().min(1).max(5000),
  status: z.enum(SESSION_STATUSES).default("open"),
  linkedNodeIds: z.array(safeIdSchema).max(500).default([]),
  linkedEdgeIds: z.array(safeIdSchema).max(500).default([]),
  notesMarkdown: z.string().max(100000).default(""),
  hypotheses: z.array(z.string().trim().min(1).max(5000)).max(100).default([]),
  aiTranscriptReferences: z.array(linkReferenceSchema).max(100).default([]),
  resolutionSummary: z.string().max(50000).default(""),
  createdAt: z.string().trim().datetime().optional(),
  updatedAt: z.string().trim().datetime().optional(),
});

export const troubleshootingSessionPatchSchema = z.object({
  title: z.string().trim().min(1).max(256).optional(),
  summary: z.string().trim().min(1).max(5000).optional(),
  status: z.enum(SESSION_STATUSES).optional(),
  linkedNodeIds: z.array(safeIdSchema).max(500).optional(),
  linkedEdgeIds: z.array(safeIdSchema).max(500).optional(),
  notesMarkdown: z.string().max(100000).optional(),
  hypotheses: z.array(z.string().trim().min(1).max(5000)).max(100).optional(),
  aiTranscriptReferences: z.array(linkReferenceSchema).max(100).optional(),
  resolutionSummary: z.string().max(50000).optional(),
});

export const patternExtractionSchema = z.object({
  title: z.string().trim().min(1).max(256),
  summary: z.string().trim().min(1).max(5000),
  symptom: z.string().trim().min(1).max(5000),
  resolution: z.string().trim().min(1).max(50000),
  tags: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(256),
  diagramId: safeIdSchema.optional(),
  nodeId: safeIdSchema.optional(),
  edgeId: safeIdSchema.optional(),
  limit: z.number().int().positive().max(100).default(20),
});

export const artifactOwnerSchema = z.object({
  ownerType: z.enum(["node", "edge", "session"]),
  diagramId: safeIdSchema.optional(),
  ownerId: safeIdSchema,
  label: z.string().trim().max(256).optional(),
});

