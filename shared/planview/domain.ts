export const NODE_SHAPE_TYPES = [
  "service",
  "database",
  "gateway",
  "queue",
  "client",
  "cloud",
  "cache",
  "storage",
  "function",
  "container",
  "custom",
] as const;

export type NodeShapeType = (typeof NODE_SHAPE_TYPES)[number];

export const NODE_RENDER_TYPES = [
  "archNode",
  "databaseSchemaNode",
  "groupNode",
  "textNode",
] as const;

export type NodeRenderType = (typeof NODE_RENDER_TYPES)[number];

export const LINK_KINDS = [
  "documentation",
  "dashboard",
  "logs",
  "trace",
  "runbook",
  "ai-transcript",
  "other",
] as const;

export type LinkKind = (typeof LINK_KINDS)[number];

export const SESSION_STATUSES = ["open", "resolved", "archived"] as const;
export type TroubleshootingSessionStatus = (typeof SESSION_STATUSES)[number];

export const TIMELINE_ENTRY_KINDS = [
  "observation",
  "hypothesis",
  "command",
  "comment",
  "status",
  "resolution",
] as const;

export type TimelineEntryKind = (typeof TIMELINE_ENTRY_KINDS)[number];

export const SESSION_COMMAND_STATUSES = ["planned", "ran", "failed"] as const;
export type SessionCommandStatus = (typeof SESSION_COMMAND_STATUSES)[number];

export interface DiagramLinkReference {
  id: string;
  label: string;
  url: string;
  kind: LinkKind;
}

export interface ArtifactReference {
  id: string;
  artifactId: string;
  label: string;
  fileName: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

export interface DiagramNodeMetadata {
  title: string;
  description: string;
  tags: string[];
  owner: string;
  documentationLinks: DiagramLinkReference[];
  dashboardLinks: DiagramLinkReference[];
  logLinks: DiagramLinkReference[];
  traceLinks: DiagramLinkReference[];
  runbookLinks: DiagramLinkReference[];
  knownFailureModes: string[];
  notesMarkdown: string;
  attachments: ArtifactReference[];
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
}

export interface DiagramEdgeMetadata {
  relationshipType: string;
  protocol: string;
  authAssumptions: string;
  dependencyNotes: string;
  knownFailureModes: string[];
  evidenceReferences: DiagramLinkReference[];
  notesMarkdown: string;
  commentsMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  constraint?: "primary" | "foreign" | "unique" | "nullable";
}

export interface DiagramPosition {
  x: number;
  y: number;
}

export interface DiagramNodeRecord {
  id: string;
  type: NodeRenderType;
  position: DiagramPosition;
  parentId?: string;
  extent?: unknown;
  expandParent?: boolean;
  width?: number;
  height?: number;
  zIndex?: number;
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
}

export interface DiagramEdgeRecord {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string;
  type?: string;
  animated?: boolean;
  data?: Record<string, unknown>;
  style?: Record<string, unknown>;
  markerEnd?: unknown;
}

export interface DiagramSummary {
  id: string;
  projectId?: string | null;
  name: string;
  description: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  edgeCount: number;
  sessionCount: number;
  openSessionCount: number;
}

export interface DiagramDocument extends DiagramSummary {
  mermaidCode: string;
  nodes: DiagramNodeRecord[];
  edges: DiagramEdgeRecord[];
  warnings?: string[];
}

export interface SessionTimelineEntry {
  id: string;
  kind: TimelineEntryKind;
  title: string;
  body: string;
  author: string;
  occurredAt: string;
  createdAt: string;
}

export interface SessionComment {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCommand {
  id: string;
  command: string;
  summary: string;
  outputExcerpt: string;
  status: SessionCommandStatus;
  createdAt: string;
}

export interface TroubleshootingSession {
  id: string;
  diagramId: string;
  projectId?: string | null;
  systemScope?: string;
  title: string;
  summary: string;
  status: TroubleshootingSessionStatus;
  linkedNodeIds: string[];
  linkedEdgeIds: string[];
  timelineEntries: SessionTimelineEntry[];
  notesMarkdown: string;
  hypotheses: string[];
  commands: SessionCommand[];
  aiTranscriptReferences: DiagramLinkReference[];
  artifacts: ArtifactReference[];
  comments: SessionComment[];
  resolutionSummary: string;
  reusablePatternId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface KnowledgePattern {
  id: string;
  sourceSessionId: string;
  title: string;
  summary: string;
  symptom: string;
  resolution: string;
  tags: string[];
  linkedNodeIds: string[];
  linkedEdgeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TroubleshootingSearchHit {
  type: "session" | "pattern";
  id: string;
  title: string;
  summary: string;
  diagramId?: string;
  sessionId?: string;
  score: number;
  updatedAt: string;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanLinkReference(value: unknown): DiagramLinkReference | null {
  if (!isRecord(value)) return null;
  const url = cleanString(value.url).trim();
  if (!url) return null;
  const id = cleanString(value.id).trim() || url;
  const rawKind = cleanString(value.kind).trim();
  const kind = (LINK_KINDS as readonly string[]).includes(rawKind) ? (rawKind as LinkKind) : "other";
  return {
    id,
    label: cleanString(value.label).trim() || url,
    url,
    kind,
  };
}

function cleanLinkArray(value: unknown): DiagramLinkReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanLinkReference)
    .filter((item): item is DiagramLinkReference => Boolean(item));
}

function cleanArtifactReference(value: unknown): ArtifactReference | null {
  if (!isRecord(value)) return null;
  const artifactId = cleanString(value.artifactId).trim();
  const relativePath = cleanString(value.relativePath).trim();
  if (!artifactId || !relativePath) return null;
  return {
    id: cleanString(value.id).trim() || artifactId,
    artifactId,
    label: cleanString(value.label).trim() || cleanString(value.fileName).trim() || artifactId,
    fileName: cleanString(value.fileName).trim() || artifactId,
    relativePath,
    mimeType: cleanString(value.mimeType).trim() || "application/octet-stream",
    sizeBytes: typeof value.sizeBytes === "number" && Number.isFinite(value.sizeBytes) ? value.sizeBytes : 0,
    checksumSha256: cleanString(value.checksumSha256).trim(),
    createdAt: cleanString(value.createdAt).trim() || new Date(0).toISOString(),
  };
}

function cleanArtifactArray(value: unknown): ArtifactReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanArtifactReference)
    .filter((item): item is ArtifactReference => Boolean(item));
}

export function createEmptyNodeMetadata(
  title: string,
  now: string,
  description = ""
): DiagramNodeMetadata {
  return {
    title,
    description,
    tags: [],
    owner: "",
    documentationLinks: [],
    dashboardLinks: [],
    logLinks: [],
    traceLinks: [],
    runbookLinks: [],
    knownFailureModes: [],
    notesMarkdown: "",
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createEmptyEdgeMetadata(now: string): DiagramEdgeMetadata {
  return {
    relationshipType: "",
    protocol: "",
    authAssumptions: "",
    dependencyNotes: "",
    knownFailureModes: [],
    evidenceReferences: [],
    notesMarkdown: "",
    commentsMarkdown: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeNodeMetadata(
  value: unknown,
  options: { title: string; now: string; fallbackDescription?: string }
): DiagramNodeMetadata {
  const source = isRecord(value) ? value : {};
  const createdAt = cleanString(source.createdAt).trim() || options.now;
  return {
    title: cleanString(source.title).trim() || options.title,
    description: cleanString(source.description).trim() || options.fallbackDescription || "",
    tags: cleanStringArray(source.tags),
    owner: cleanString(source.owner).trim(),
    documentationLinks: cleanLinkArray(source.documentationLinks),
    dashboardLinks: cleanLinkArray(source.dashboardLinks),
    logLinks: cleanLinkArray(source.logLinks),
    traceLinks: cleanLinkArray(source.traceLinks),
    runbookLinks: cleanLinkArray(source.runbookLinks),
    knownFailureModes: cleanStringArray(source.knownFailureModes),
    notesMarkdown: cleanString(source.notesMarkdown),
    attachments: cleanArtifactArray(source.attachments),
    createdAt,
    updatedAt: cleanString(source.updatedAt).trim() || options.now,
    lastVerifiedAt: cleanString(source.lastVerifiedAt).trim() || undefined,
  };
}

export function normalizeEdgeMetadata(value: unknown, now: string): DiagramEdgeMetadata {
  const source = isRecord(value) ? value : {};
  const createdAt = cleanString(source.createdAt).trim() || now;
  return {
    relationshipType: cleanString(source.relationshipType).trim(),
    protocol: cleanString(source.protocol).trim(),
    authAssumptions: cleanString(source.authAssumptions).trim(),
    dependencyNotes: cleanString(source.dependencyNotes).trim(),
    knownFailureModes: cleanStringArray(source.knownFailureModes),
    evidenceReferences: cleanLinkArray(source.evidenceReferences),
    notesMarkdown: cleanString(source.notesMarkdown),
    commentsMarkdown: cleanString(source.commentsMarkdown),
    createdAt,
    updatedAt: cleanString(source.updatedAt).trim() || now,
  };
}

export function readNodeLabel(node: DiagramNodeRecord): string {
  const label = typeof node.data.label === "string" ? node.data.label : "";
  if (label) return label;
  const text = typeof node.data.text === "string" ? node.data.text : "";
  if (text) return text;
  return node.id;
}

export function readNodeDescription(node: DiagramNodeRecord): string {
  return typeof node.data.description === "string" ? node.data.description : "";
}

export function readNodeShapeType(node: DiagramNodeRecord): NodeShapeType {
  const raw = typeof node.data.shapeType === "string" ? node.data.shapeType : "service";
  return (NODE_SHAPE_TYPES as readonly string[]).includes(raw) ? (raw as NodeShapeType) : "service";
}

export function readNodeMetadata(node: DiagramNodeRecord, now: string): DiagramNodeMetadata {
  return normalizeNodeMetadata(node.data.metadata, {
    title: readNodeLabel(node),
    now,
    fallbackDescription: readNodeDescription(node),
  });
}

export function withNodeMetadata(
  node: DiagramNodeRecord,
  metadata: DiagramNodeMetadata
): DiagramNodeRecord {
  const nextData = {
    ...node.data,
    metadata,
    label: metadata.title,
    description:
      typeof node.data.description === "string" ? node.data.description : metadata.description,
  };
  return { ...node, data: nextData };
}

export function readEdgeLabel(edge: DiagramEdgeRecord): string {
  if (typeof edge.data?.label === "string" && edge.data.label) return edge.data.label;
  if (typeof edge.label === "string" && edge.label) return edge.label;
  return "";
}

export function readEdgeMetadata(edge: DiagramEdgeRecord, now: string): DiagramEdgeMetadata {
  return normalizeEdgeMetadata(edge.data?.metadata, now);
}

export function withEdgeMetadata(
  edge: DiagramEdgeRecord,
  metadata: DiagramEdgeMetadata
): DiagramEdgeRecord {
  return {
    ...edge,
    data: {
      ...(edge.data ?? {}),
      metadata,
      label: edge.data?.label ?? edge.label,
    },
  };
}
