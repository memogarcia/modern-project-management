import {
  createEmptyEdgeMetadata,
  createEmptyNodeMetadata,
  type DiagramDocument,
  type DiagramEdgeRecord,
  type DiagramPerspective,
  type DiagramNodeMetadata,
  type DiagramNodeRecord,
  type DiagramSummary,
  normalizeEdgeMetadata,
  normalizeNodeMetadata,
  readEdgeLabel,
  readNodeDescription,
  readNodeLabel,
  readNodeShapeType,
  withEdgeMetadata,
  withNodeMetadata,
} from "./domain.js";

export interface SafeJsonParseResult<T> {
  value: T;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function safeParseJson<T>(
  raw: string | null | undefined,
  fallback: T,
  label: string
): SafeJsonParseResult<T> {
  if (!raw) {
    return { value: fallback, warnings: [] };
  }

  try {
    return { value: JSON.parse(raw) as T, warnings: [] };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    return {
      value: fallback,
      warnings: [`${label}: ${message}`],
    };
  }
}

export function normalizeNodeRecord(
  value: unknown,
  now: string,
  index: number
): SafeJsonParseResult<DiagramNodeRecord | null> {
  if (!isRecord(value)) {
    return {
      value: null,
      warnings: [`Node ${index + 1}: ignored malformed node entry.`],
    };
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  if (!id) {
    return {
      value: null,
      warnings: [`Node ${index + 1}: ignored node without an id.`],
    };
  }

  const type =
    value.type === "databaseSchemaNode" ||
    value.type === "groupNode" ||
    value.type === "textNode"
      ? value.type
      : "archNode";

  const positionRecord = safeRecord(value.position);
  const node: DiagramNodeRecord = {
    id,
    type,
    position: {
      x: safeNumber(positionRecord.x),
      y: safeNumber(positionRecord.y),
    },
    parentId: typeof value.parentId === "string" ? value.parentId : undefined,
    extent: value.extent,
    expandParent: typeof value.expandParent === "boolean" ? value.expandParent : undefined,
    width: typeof value.width === "number" ? value.width : undefined,
    height: typeof value.height === "number" ? value.height : undefined,
    zIndex: typeof value.zIndex === "number" ? value.zIndex : undefined,
    data: safeRecord(value.data),
    style: isRecord(value.style) ? value.style : undefined,
  };

  const title = readNodeLabel(node);
  const description = readNodeDescription(node);
  const rawMetadata = node.data.metadata;
  const metadata: DiagramNodeMetadata = rawMetadata
    ? normalizeNodeMetadata(rawMetadata, {
        title,
        now,
        fallbackDescription: description,
      })
    : createEmptyNodeMetadata(title, now, description);

  const normalized = withNodeMetadata(
    {
      ...node,
      data: {
        ...node.data,
        shapeType: readNodeShapeType(node),
      },
    },
    metadata
  );

  return {
    value: normalized,
    warnings: [],
  };
}

export function normalizeEdgeRecord(
  value: unknown,
  now: string,
  index: number
): SafeJsonParseResult<DiagramEdgeRecord | null> {
  if (!isRecord(value)) {
    return {
      value: null,
      warnings: [`Edge ${index + 1}: ignored malformed edge entry.`],
    };
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const source = typeof value.source === "string" ? value.source.trim() : "";
  const target = typeof value.target === "string" ? value.target.trim() : "";

  if (!id || !source || !target) {
    return {
      value: null,
      warnings: [`Edge ${index + 1}: ignored edge missing id, source, or target.`],
    };
  }

  const edge: DiagramEdgeRecord = {
    id,
    source,
    target,
    sourceHandle: typeof value.sourceHandle === "string" ? value.sourceHandle : null,
    targetHandle: typeof value.targetHandle === "string" ? value.targetHandle : null,
    label: typeof value.label === "string" ? value.label : undefined,
    type: typeof value.type === "string" ? value.type : undefined,
    animated: typeof value.animated === "boolean" ? value.animated : undefined,
    data: isRecord(value.data) ? value.data : {},
    style: isRecord(value.style) ? value.style : undefined,
    markerEnd: value.markerEnd,
  };

  const metadata = edge.data?.metadata
    ? normalizeEdgeMetadata(edge.data.metadata, now)
    : createEmptyEdgeMetadata(now);

  return {
    value: withEdgeMetadata(
      {
        ...edge,
        label: readEdgeLabel(edge) || edge.label,
      },
      metadata
    ),
    warnings: [],
  };
}

export function normalizeNodeArray(
  value: unknown,
  now: string,
  label: string
): SafeJsonParseResult<DiagramNodeRecord[]> {
  if (!Array.isArray(value)) {
    return {
      value: [],
      warnings: [`${label}: expected an array of nodes.`],
    };
  }

  const warnings: string[] = [];
  const nodes: DiagramNodeRecord[] = [];

  value.forEach((entry, index) => {
    const result = normalizeNodeRecord(entry, now, index);
    warnings.push(...result.warnings);
    if (result.value) nodes.push(result.value);
  });

  return { value: nodes, warnings };
}

export function normalizeEdgeArray(
  value: unknown,
  now: string,
  label: string
): SafeJsonParseResult<DiagramEdgeRecord[]> {
  if (!Array.isArray(value)) {
    return {
      value: [],
      warnings: [`${label}: expected an array of edges.`],
    };
  }

  const warnings: string[] = [];
  const edges: DiagramEdgeRecord[] = [];

  value.forEach((entry, index) => {
    const result = normalizeEdgeRecord(entry, now, index);
    warnings.push(...result.warnings);
    if (result.value) edges.push(result.value);
  });

  return { value: edges, warnings };
}

export function normalizeDiagramGraph(
  rawNodes: string | null | undefined,
  rawEdges: string | null | undefined,
  now: string,
  label: string
): SafeJsonParseResult<{ nodes: DiagramNodeRecord[]; edges: DiagramEdgeRecord[] }> {
  const parsedNodes = safeParseJson<unknown[]>(rawNodes, [], `${label} nodes`);
  const parsedEdges = safeParseJson<unknown[]>(rawEdges, [], `${label} edges`);
  const normalizedNodes = normalizeNodeArray(parsedNodes.value, now, `${label} nodes`);
  const normalizedEdges = normalizeEdgeArray(parsedEdges.value, now, `${label} edges`);

  return {
    value: {
      nodes: normalizedNodes.value,
      edges: normalizedEdges.value,
    },
    warnings: [
      ...parsedNodes.warnings,
      ...parsedEdges.warnings,
      ...normalizedNodes.warnings,
      ...normalizedEdges.warnings,
    ],
  };
}

export function createDiagramSummary(row: {
  id: string;
  project_id?: string | null;
  name: string;
  description?: string | null;
  revision?: number | null;
  created_at: string;
  updated_at: string;
  node_count?: number | null;
  edge_count?: number | null;
  session_count?: number | null;
  open_session_count?: number | null;
}): DiagramSummary {
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name,
    description: row.description ?? "",
    revision: row.revision ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nodeCount: row.node_count ?? 0,
    edgeCount: row.edge_count ?? 0,
    sessionCount: row.session_count ?? 0,
    openSessionCount: row.open_session_count ?? 0,
  };
}

export function hydrateDiagramDocument(
  row: {
    id: string;
    project_id?: string | null;
    name: string;
    description?: string | null;
    revision?: number | null;
    mermaid_code?: string | null;
    nodes?: string | null;
    edges?: string | null;
    created_at: string;
    updated_at: string;
    node_count?: number | null;
    edge_count?: number | null;
    session_count?: number | null;
    open_session_count?: number | null;
  },
  label: string,
  perspectives: DiagramPerspective[] = []
): DiagramDocument {
  const summary = createDiagramSummary(row);
  const graph = normalizeDiagramGraph(row.nodes, row.edges, summary.updatedAt, label);
  return {
    ...summary,
    mermaidCode: row.mermaid_code ?? "",
    nodes: graph.value.nodes,
    edges: graph.value.edges,
    perspectives,
    warnings: graph.warnings.length > 0 ? graph.warnings : undefined,
  };
}
