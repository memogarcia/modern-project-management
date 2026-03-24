import { z } from "zod";
import {
  DIAGRAM_PERSPECTIVE_KINDS,
  LINK_KINDS,
  SESSION_COMMAND_STATUSES,
  SESSION_STATUSES,
  TIMELINE_ENTRY_KINDS,
} from "./domain.js";

export const SAFE_ENTITY_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

const safeIdSchema = z
  .string()
  .trim()
  .regex(SAFE_ENTITY_ID_RE, "IDs must use only letters, numbers, underscores, and hyphens.")
  .describe("Stable identifier using only letters, numbers, underscores, and hyphens.");

const linkReferenceSchema = z.object({
  id: z.string().trim().min(1).max(256).describe("Stable link reference ID."),
  label: z.string().trim().min(1).max(256).describe("Short human-readable link label."),
  url: z.string().trim().url().describe("Absolute URL for the linked document or system."),
  kind: z.enum(LINK_KINDS).describe("Type of link, for example documentation, dashboard, logs, or trace."),
});

const artifactReferenceSchema = z.object({
  id: z.string().trim().min(1).max(256).describe("Stable attachment reference ID."),
  artifactId: z.string().trim().min(1).max(256).describe("Artifact ID returned by `attach_artifact`."),
  label: z.string().trim().min(1).max(256).describe("Human-readable attachment label."),
  fileName: z.string().trim().min(1).max(512).describe("Original artifact file name."),
  relativePath: z.string().trim().min(1).max(2048).describe("Relative artifact path inside the artifact store."),
  mimeType: z.string().trim().min(1).max(255).describe("Artifact MIME type."),
  sizeBytes: z.number().int().nonnegative().describe("Artifact size in bytes."),
  checksumSha256: z.string().trim().min(1).max(128).describe("Artifact SHA-256 checksum."),
  createdAt: z.string().trim().datetime().describe("Artifact creation time in ISO 8601 format."),
});

export const nodeMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1)
    .max(256)
    .describe("Human-readable component title. Keep it aligned with the node label."),
  description: z
    .string()
    .max(20000)
    .default("")
    .describe("Short operational description of what this component does."),
  tags: z
    .array(z.string().trim().min(1).max(64))
    .max(50)
    .default([])
    .describe("Short classification tags such as team, domain, tier, or criticality."),
  owner: z.string().trim().max(256).default("").describe("Owning team, person, or group alias."),
  documentationLinks: z
    .array(linkReferenceSchema)
    .max(100)
    .default([])
    .describe("Reference docs for the component."),
  dashboardLinks: z
    .array(linkReferenceSchema)
    .max(100)
    .default([])
    .describe("Monitoring dashboards for the component."),
  logLinks: z.array(linkReferenceSchema).max(100).default([]).describe("Primary log views or queries."),
  traceLinks: z.array(linkReferenceSchema).max(100).default([]).describe("Tracing entry points or saved traces."),
  runbookLinks: z.array(linkReferenceSchema).max(100).default([]).describe("Runbooks used to operate or recover the component."),
  knownFailureModes: z
    .array(z.string().trim().min(1).max(2000))
    .max(100)
    .default([])
    .describe("Recurring or expected ways this component can fail."),
  notesMarkdown: z
    .string()
    .max(100000)
    .default("")
    .describe("Durable free-form notes in Markdown."),
  attachments: z
    .array(artifactReferenceSchema)
    .max(200)
    .default([])
    .describe("Artifact references already stored with `attach_artifact`; do not inline raw bytes here."),
  createdAt: z.string().trim().datetime().describe("Creation time in ISO 8601 format."),
  updatedAt: z.string().trim().datetime().describe("Last update time in ISO 8601 format."),
  lastVerifiedAt: z
    .string()
    .trim()
    .datetime()
    .optional()
    .describe("Optional ISO 8601 time when this metadata was last verified."),
});

export const edgeMetadataSchema = z.object({
  relationshipType: z
    .string()
    .trim()
    .max(256)
    .default("")
    .describe("Kind of dependency, for example dependency, event-stream, or replication."),
  protocol: z
    .string()
    .trim()
    .max(256)
    .default("")
    .describe("Protocol or transport such as HTTPS, gRPC, postgres, or Kafka."),
  authAssumptions: z
    .string()
    .max(10000)
    .default("")
    .describe("Auth or trust assumptions required for this dependency."),
  dependencyNotes: z
    .string()
    .max(20000)
    .default("")
    .describe("Operational notes about how the source depends on the target."),
  knownFailureModes: z
    .array(z.string().trim().min(1).max(2000))
    .max(100)
    .default([])
    .describe("Ways this dependency commonly fails or degrades."),
  evidenceReferences: z
    .array(linkReferenceSchema)
    .max(100)
    .default([])
    .describe("Links to evidence, docs, dashboards, or traces for this dependency."),
  notesMarkdown: z
    .string()
    .max(100000)
    .default("")
    .describe("Durable Markdown notes about the relationship."),
  commentsMarkdown: z
    .string()
    .max(100000)
    .default("")
    .describe("Additional Markdown comments for analyst context."),
  createdAt: z.string().trim().datetime().describe("Creation time in ISO 8601 format."),
  updatedAt: z.string().trim().datetime().describe("Last update time in ISO 8601 format."),
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

export const diagramPerspectiveSchema = z.object({
  id: safeIdSchema.describe("Stable perspective ID."),
  title: z.string().trim().min(1).max(256).describe("Perspective title shown to readers."),
  description: z.string().max(10000).default("").describe("Short explanation of the audience or purpose."),
  kind: z
    .enum(DIAGRAM_PERSPECTIVE_KINDS)
    .describe("Perspective type such as custom, onboarding, operations, or security."),
  nodeIds: z.array(safeIdSchema).max(5000).default([]).describe("Node IDs included in the perspective."),
  edgeIds: z.array(safeIdSchema).max(5000).default([]).describe("Edge IDs included in the perspective."),
  createdAt: z.string().trim().datetime().optional().describe("Creation time in ISO 8601 format."),
  updatedAt: z.string().trim().datetime().optional().describe("Last update time in ISO 8601 format."),
});

export const timelineEntrySchema = z.object({
  id: safeIdSchema.optional().describe("Optional stable timeline entry ID."),
  kind: z
    .enum(TIMELINE_ENTRY_KINDS)
    .describe("Timeline entry type such as observation, hypothesis, command, status, or resolution."),
  title: z.string().trim().min(1).max(256).describe("Short timeline headline."),
  body: z.string().max(50000).default("").describe("Detailed timeline body in plain text or Markdown."),
  author: z.string().trim().max(256).default("").describe("Person, team, or agent that produced the entry."),
  occurredAt: z.string().trim().datetime().describe("When the event occurred in ISO 8601 format."),
  createdAt: z.string().trim().datetime().optional().describe("Optional entry creation time in ISO 8601 format."),
});

export const sessionCommentSchema = z.object({
  id: safeIdSchema.optional().describe("Optional stable comment ID."),
  author: z.string().trim().min(1).max(256).describe("Comment author."),
  body: z.string().trim().min(1).max(50000).describe("Comment body."),
  createdAt: z.string().trim().datetime().optional().describe("Optional creation time in ISO 8601 format."),
  updatedAt: z.string().trim().datetime().optional().describe("Optional update time in ISO 8601 format."),
});

export const sessionCommandSchema = z.object({
  id: safeIdSchema.optional().describe("Optional stable command record ID."),
  command: z.string().trim().min(1).max(10000).describe("Exact command or query that was run or planned."),
  summary: z.string().max(10000).default("").describe("Short explanation of why the command matters."),
  outputExcerpt: z
    .string()
    .max(50000)
    .default("")
    .describe("Key command output excerpt, not the full raw log unless necessary."),
  status: z
    .enum(SESSION_COMMAND_STATUSES)
    .default("ran")
    .describe("Whether the command is planned, ran successfully, or failed."),
  createdAt: z.string().trim().datetime().optional().describe("Optional creation time in ISO 8601 format."),
});

export const troubleshootingSessionCreateSchema = z.object({
  id: safeIdSchema.optional().describe("Optional stable troubleshooting session ID."),
  diagramId: safeIdSchema.describe("Diagram ID this investigation belongs to."),
  projectId: safeIdSchema.nullish().describe("Optional external project or ticket identifier."),
  systemScope: z
    .string()
    .trim()
    .max(512)
    .optional()
    .describe("Optional description of the affected subsystem or user journey."),
  title: z.string().trim().min(1).max(256).describe("Short investigation title."),
  summary: z.string().trim().min(1).max(5000).describe("Current problem statement."),
  status: z.enum(SESSION_STATUSES).default("open").describe("Investigation status."),
  linkedNodeIds: z
    .array(safeIdSchema)
    .max(500)
    .default([])
    .describe("Node IDs implicated in the investigation. Discover these with `get_diagram_metadata`."),
  linkedEdgeIds: z
    .array(safeIdSchema)
    .max(500)
    .default([])
    .describe("Edge IDs implicated in the investigation. Discover these with `get_diagram_metadata`."),
  notesMarkdown: z.string().max(100000).default("").describe("Durable investigation notes in Markdown."),
  hypotheses: z
    .array(z.string().trim().min(1).max(5000))
    .max(100)
    .default([])
    .describe("Current working theories for the cause."),
  aiTranscriptReferences: z
    .array(linkReferenceSchema)
    .max(100)
    .default([])
    .describe("Links to AI transcript or chat artifacts relevant to the investigation."),
  resolutionSummary: z.string().max(50000).default("").describe("Durable summary of the final resolution."),
  createdAt: z.string().trim().datetime().optional().describe("Optional creation time in ISO 8601 format."),
  updatedAt: z.string().trim().datetime().optional().describe("Optional update time in ISO 8601 format."),
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
  title: z.string().trim().min(1).max(256).describe("Short reusable pattern title."),
  summary: z.string().trim().min(1).max(5000).describe("Concise summary of the pattern."),
  symptom: z.string().trim().min(1).max(5000).describe("Observable symptom that triggers this pattern."),
  resolution: z.string().trim().min(1).max(50000).describe("Recommended resolution or mitigation path."),
  tags: z
    .array(z.string().trim().min(1).max(64))
    .max(100)
    .default([])
    .describe("Search-friendly tags for the pattern."),
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
