import type {
  DiagramEdgeRecord,
  DiagramNodeRecord,
  NodeShapeType,
  SchemaColumn,
} from "./domain.js";

export interface MermaidSubgraph {
  key: string;
  id: string;
  label: string;
  parentKey: string | null;
  depth: number;
  order: number;
  nodeIds: string[];
}

export interface MermaidDiagnostic {
  line: number;
  message: string;
}

export class MermaidParseError extends Error {
  diagnostics: MermaidDiagnostic[];

  constructor(message: string, diagnostics: MermaidDiagnostic[]) {
    super(message);
    this.name = "MermaidParseError";
    this.diagnostics = diagnostics;
  }
}

type MermaidNodeSyntax =
  | "cylinder"
  | "stadium"
  | "hexagon"
  | "circle"
  | "diamond"
  | "trapezoid"
  | "rect"
  | "simple";

type ParsedNodeDefinition = {
  id: string;
  label: string;
  inferredShapeType: NodeShapeType;
};

type ParsedSubgraphDefinition = {
  key: string;
  id: string;
  label: string;
  order: number;
};

type ExistingGraph = {
  nodes?: DiagramNodeRecord[];
  edges?: DiagramEdgeRecord[];
};

function escapeMermaidText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function decodeMermaidText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function sanitizeErName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

function sanitizeSubgraphId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function buildParsedNode(id: string, rawLabel: string, syntax: MermaidNodeSyntax): ParsedNodeDefinition {
  const label = decodeMermaidText(rawLabel);
  return {
    id,
    label,
    inferredShapeType: inferShapeTypeFromMermaidSyntax(syntax, label),
  };
}

function buildParsedSubgraph(id: string, keySeed: string, label: string, order: number): ParsedSubgraphDefinition {
  return {
    id,
    key: `${sanitizeSubgraphId(keySeed) || "subgraph"}_${order + 1}`,
    label,
    order,
  };
}

function parseSubgraphDefinition(line: string, order: number): ParsedSubgraphDefinition | null {
  let match = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*\["([^"]+)"\]\s*$/);
  if (match) {
    return buildParsedSubgraph(match[1], match[1], decodeMermaidText(match[2]), order);
  }

  match = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*\[([^\]]+)\]\s*$/);
  if (match) {
    return buildParsedSubgraph(match[1], match[1], decodeMermaidText(match[2]), order);
  }

  match = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s+(.+)\s*$/);
  if (match) {
    return buildParsedSubgraph(match[1], match[1], decodeMermaidText(stripWrappingQuotes(match[2])), order);
  }

  match = line.match(/^subgraph\s+"([^"]+)"\s*$/);
  if (match) {
    const label = decodeMermaidText(match[1]);
    const id = sanitizeSubgraphId(label) || `subgraph_${order + 1}`;
    return buildParsedSubgraph(id, id, label, order);
  }

  match = line.match(/^subgraph\s+(.+)\s*$/);
  if (match) {
    const label = decodeMermaidText(stripWrappingQuotes(match[1]));
    const id = sanitizeSubgraphId(label) || `subgraph_${order + 1}`;
    return buildParsedSubgraph(id, id, label, order);
  }

  return null;
}

function parseNodeDefinition(line: string): ParsedNodeDefinition | null {
  let match = line.match(/^(\w+)\[\("([^"]+)"\)\]/);
  if (match) return buildParsedNode(match[1], match[2], "cylinder");

  match = line.match(/^(\w+)\(\["([^"]+)"\]\)/);
  if (match) return buildParsedNode(match[1], match[2], "stadium");

  match = line.match(/^(\w+)\{\{"([^"]+)"\}\}/);
  if (match) return buildParsedNode(match[1], match[2], "hexagon");

  match = line.match(/^(\w+)\(\("([^"]+)"\)\)/);
  if (match) return buildParsedNode(match[1], match[2], "circle");

  match = line.match(/^(\w+)\{"([^"]+)"\}/);
  if (match) return buildParsedNode(match[1], match[2], "diamond");

  match = line.match(/^(\w+)\[\/"([^"]+)"\\]/);
  if (match) return buildParsedNode(match[1], match[2], "trapezoid");

  match = line.match(/^(\w+)\["([^"]+)"\]/);
  if (match) return buildParsedNode(match[1], match[2], "rect");

  match = line.match(/^(\w+)\(([^)]+)\)/);
  if (match) return buildParsedNode(match[1], match[2], "simple");

  return null;
}

function inferShapeTypeFromMermaidSyntax(syntax: MermaidNodeSyntax, label: string): NodeShapeType {
  const normalized = label.toLowerCase().replace(/\s+/g, " ").trim();

  switch (syntax) {
    case "cylinder":
      return /(s3|blob|bucket|object storage|filestore|storage)/.test(normalized)
        ? "storage"
        : "database";
    case "stadium":
      if (/(client|browser|mobile|ios|android|spa|frontend)/.test(normalized)) return "client";
      return "gateway";
    case "hexagon":
      return "queue";
    case "diamond":
      return "cache";
    case "trapezoid":
      return "function";
    case "circle":
      return "custom";
    case "rect":
    case "simple":
      if (/(cdn|waf|cloud|region|vpc|edge)/.test(normalized)) return "cloud";
      if (/(container|pod)/.test(normalized)) return "container";
      if (/(client|browser|mobile)/.test(normalized)) return "client";
      return "service";
    default:
      return "service";
  }
}

function formatArchNodeForMermaid(node: DiagramNodeRecord): string {
  const label = escapeMermaidText(String(node.data.label ?? node.id));
  const rawShape = typeof node.data.shapeType === "string" ? node.data.shapeType : "service";
  const shapeType = rawShape as NodeShapeType;

  switch (shapeType) {
    case "database":
    case "storage":
      return `${node.id}[("${label}")]`;
    case "gateway":
    case "client":
      return `${node.id}(["${label}"])`;
    case "queue":
      return `${node.id}{{"${label}"}}`;
    case "cache":
      return `${node.id}{"${label}"}`;
    case "function":
      return `${node.id}[/"${label}"\\]`;
    default:
      return `${node.id}["${label}"]`;
  }
}

function stableNodeSort(a: DiagramNodeRecord, b: DiagramNodeRecord): number {
  return a.id.localeCompare(b.id);
}

function stableEdgeSort(a: DiagramEdgeRecord, b: DiagramEdgeRecord): number {
  const aLabel = typeof a.data?.label === "string" ? a.data.label : a.label ?? "";
  const bLabel = typeof b.data?.label === "string" ? b.data.label : b.label ?? "";
  return `${a.source}|${a.target}|${aLabel}|${a.id}`.localeCompare(`${b.source}|${b.target}|${bLabel}|${b.id}`);
}

function makeStableEdgeId(
  source: string,
  target: string,
  label: string | undefined,
  occurrence: number
): string {
  const normalizedLabel = (label ?? "").trim() || "nolabel";
  return `e-${source}-${target}-${hashLabelToken(normalizedLabel)}-${occurrence}`;
}

function hashLabelToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildExistingEdgeBuckets(edges: DiagramEdgeRecord[] | undefined): Map<string, DiagramEdgeRecord[]> {
  const buckets = new Map<string, DiagramEdgeRecord[]>();
  for (const edge of edges ?? []) {
    const label = typeof edge.data?.label === "string" ? edge.data.label : edge.label ?? "";
    const key = `${edge.source}|${edge.target}|${label}`;
    const existing = buckets.get(key) ?? [];
    existing.push(edge);
    buckets.set(key, existing);
  }

  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => a.id.localeCompare(b.id));
  }

  return buckets;
}

function takeExistingEdge(
  buckets: Map<string, DiagramEdgeRecord[]>,
  source: string,
  target: string,
  label: string
): DiagramEdgeRecord | null {
  const key = `${source}|${target}|${label}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.length === 0) return null;
  return bucket.shift() ?? null;
}

function findTableNodeId(tableName: string, existingNodes: Map<string, DiagramNodeRecord>): string | null {
  for (const [id, node] of existingNodes) {
    if (
      node.type === "databaseSchemaNode" &&
      sanitizeErName(String(node.data.label ?? "")) === tableName
    ) {
      return id;
    }
  }
  return null;
}

function findTableNodeIdFromNodes(tableName: string, nodes: DiagramNodeRecord[]): string | null {
  for (const node of nodes) {
    if (
      node.type === "databaseSchemaNode" &&
      sanitizeErName(String(node.data.label ?? "")) === tableName
    ) {
      return node.id;
    }
  }
  return null;
}

function parseSchemaColumns(node: DiagramNodeRecord): SchemaColumn[] {
  if (!Array.isArray(node.data.schema)) return [];
  return node.data.schema.filter((column): column is SchemaColumn => {
    if (!column || typeof column !== "object" || Array.isArray(column)) return false;
    const record = column as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.type === "string";
  });
}

export function flowToMermaid(nodes: DiagramNodeRecord[], edges: DiagramEdgeRecord[]): string {
  const archNodes = nodes.filter((node) => node.type === "archNode").sort(stableNodeSort);
  const schemaNodes = nodes.filter((node) => node.type === "databaseSchemaNode").sort(stableNodeSort);
  const groupNodes = nodes.filter((node) => node.type === "groupNode").sort(stableNodeSort);
  const archNodeIds = new Set(archNodes.map((node) => node.id));
  const groupById = new Map(groupNodes.map((node) => [node.id, node]));
  const childrenByGroup = new Map<string | null, DiagramNodeRecord[]>();
  const childGroupsByGroup = new Map<string | null, DiagramNodeRecord[]>();

  for (const group of groupNodes) {
    const parentKey = group.parentId && groupById.has(group.parentId) ? group.parentId : null;
    const siblings = childGroupsByGroup.get(parentKey) ?? [];
    siblings.push(group);
    childGroupsByGroup.set(parentKey, siblings);
  }

  for (const node of archNodes) {
    const parentKey = node.parentId && groupById.has(node.parentId) ? node.parentId : null;
    const siblings = childrenByGroup.get(parentKey) ?? [];
    siblings.push(node);
    childrenByGroup.set(parentKey, siblings);
  }

  for (const entries of childrenByGroup.values()) {
    entries.sort(stableNodeSort);
  }
  for (const entries of childGroupsByGroup.values()) {
    entries.sort(stableNodeSort);
  }

  const lines: string[] = [];

  if (archNodes.length > 0) {
    lines.push("flowchart LR");

    const writeGroup = (groupId: string, depth: number) => {
      const group = groupById.get(groupId);
      if (!group) return;
      const indent = "    ".repeat(depth + 1);
      const label = escapeMermaidText(String(group.data.label ?? group.id));
      lines.push(`${indent}subgraph ${sanitizeSubgraphId(group.id) || group.id}["${label}"]`);
      for (const childGroup of childGroupsByGroup.get(group.id) ?? []) {
        writeGroup(childGroup.id, depth + 1);
      }
      for (const childNode of childrenByGroup.get(group.id) ?? []) {
        lines.push(`${"    ".repeat(depth + 2)}${formatArchNodeForMermaid(childNode)}`);
      }
      lines.push(`${indent}end`);
    };

    for (const group of childGroupsByGroup.get(null) ?? []) {
      writeGroup(group.id, 0);
    }

    for (const node of childrenByGroup.get(null) ?? []) {
      lines.push(`    ${formatArchNodeForMermaid(node)}`);
    }

    const archEdges = edges
      .filter((edge) => archNodeIds.has(edge.source) && archNodeIds.has(edge.target))
      .sort(stableEdgeSort);

    if (archEdges.length > 0) {
      lines.push("");
    }

    for (const edge of archEdges) {
      const rawLabel = typeof edge.data?.label === "string" ? edge.data.label : edge.label;
      if (rawLabel) {
        lines.push(`    ${edge.source} -->|${escapeMermaidText(String(rawLabel))}| ${edge.target}`);
      } else {
        lines.push(`    ${edge.source} --> ${edge.target}`);
      }
    }
  } else if (schemaNodes.length === 0 && edges.length === 0) {
    lines.push("graph TD");
  }

  if (schemaNodes.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("erDiagram");
    for (const node of schemaNodes) {
      const tableName = sanitizeErName(String(node.data.label ?? node.id));
      lines.push(`    ${tableName} {`);
      const columns = parseSchemaColumns(node);
      for (const column of columns) {
        const suffix = column.constraint ? ` ${column.constraint.toUpperCase()}` : "";
        lines.push(`        ${column.type} ${column.name}${suffix}`);
      }
      lines.push("    }");
    }

    const schemaIds = new Set(schemaNodes.map((node) => node.id));
    const schemaEdges = edges
      .filter((edge) => schemaIds.has(edge.source) && schemaIds.has(edge.target))
      .sort(stableEdgeSort);

    for (const edge of schemaEdges) {
      const sourceNode = schemaNodes.find((node) => node.id === edge.source);
      const targetNode = schemaNodes.find((node) => node.id === edge.target);
      const sourceName = sanitizeErName(String(sourceNode?.data.label ?? edge.source));
      const targetName = sanitizeErName(String(targetNode?.data.label ?? edge.target));
      const rawLabel = typeof edge.data?.label === "string" ? edge.data.label : edge.label ?? "relates";
      lines.push(`    ${sourceName} ||--o{ ${targetName} : "${escapeMermaidText(String(rawLabel))}"`);
    }
  }

  return `${lines.length > 0 ? lines.join("\n") : "graph TD"}\n`;
}

function makeArchNode(
  id: string,
  label: string,
  inferredShapeType: NodeShapeType,
  existingNode?: DiagramNodeRecord
): DiagramNodeRecord {
  const baseData = existingNode?.data ?? {};
  return {
    ...(existingNode ?? {
      id,
      type: "archNode",
      position: { x: 0, y: 0 },
      data: {},
    }),
    id,
    type: "archNode",
    data: {
      ...baseData,
      label,
      shapeType: typeof baseData.shapeType === "string" ? baseData.shapeType : inferredShapeType,
      description: typeof baseData.description === "string" ? baseData.description : "",
    },
  };
}

export function mermaidToFlow(
  mermaid: string,
  existingGraph?: ExistingGraph
): {
  nodes: DiagramNodeRecord[];
  edges: DiagramEdgeRecord[];
  subgraphs: MermaidSubgraph[];
  diagnostics: MermaidDiagnostic[];
} {
  const nodes: DiagramNodeRecord[] = [];
  const edges: DiagramEdgeRecord[] = [];
  const nodeSet = new Set<string>();
  const subgraphs: Array<Omit<MermaidSubgraph, "nodeIds"> & { nodeIds: Set<string> }> = [];
  const subgraphStack: string[] = [];
  const nodeSubgraphKeyByNodeId = new Map<string, string>();
  const existingNodes = new Map((existingGraph?.nodes ?? []).map((node) => [node.id, node]));
  const existingEdgeBuckets = buildExistingEdgeBuckets(existingGraph?.edges);
  const diagnostics: MermaidDiagnostic[] = [];
  const edgeOccurrenceByKey = new Map<string, number>();
  let subgraphOrder = 0;

  let mode: "graph" | "erDiagram" | null = null;
  let currentErTable: string | null = null;
  let currentErColumns: SchemaColumn[] = [];

  const lines = mermaid
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((raw, index) => ({ raw, line: raw.trim(), lineNumber: index + 1 }))
    .filter(({ line }) => Boolean(line));

  function currentSubgraphKey(): string | null {
    return subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null;
  }

  function trackNodeInCurrentSubgraph(nodeId: string) {
    const key = currentSubgraphKey();
    if (!key || nodeSubgraphKeyByNodeId.has(nodeId)) return;
    nodeSubgraphKeyByNodeId.set(nodeId, key);
    const subgraph = subgraphs.find((entry) => entry.key === key);
    if (subgraph) subgraph.nodeIds.add(nodeId);
  }

  function flushErTable() {
    if (!currentErTable) return;
    const existingId = findTableNodeId(currentErTable, existingNodes);
    const tableId =
      existingId ??
      `table_${sanitizeErName(currentErTable).toLowerCase() || "table"}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
    const existingNode = existingId ? existingNodes.get(existingId) : undefined;
    if (!nodeSet.has(tableId)) {
      nodeSet.add(tableId);
      nodes.push({
        ...(existingNode ?? {
          id: tableId,
          type: "databaseSchemaNode",
          position: { x: 0, y: 0 },
          data: {},
        }),
        id: tableId,
        type: "databaseSchemaNode",
        data: {
          ...(existingNode?.data ?? {}),
          label: currentErTable,
          schema: currentErColumns,
        },
      });
    }
    currentErTable = null;
    currentErColumns = [];
  }

  for (const { line, lineNumber } of lines) {
    if (line.startsWith("graph") || line.startsWith("flowchart")) {
      flushErTable();
      mode = "graph";
      continue;
    }

    if (line === "erDiagram") {
      flushErTable();
      mode = "erDiagram";
      continue;
    }

    if (line.startsWith("%%") || line.startsWith("style ") || line.startsWith("classDef") || line.startsWith("class ") || line.startsWith("linkStyle")) {
      continue;
    }

    if (mode === "graph" && line.startsWith("subgraph")) {
      const parsed = parseSubgraphDefinition(line, subgraphOrder++);
      if (!parsed) {
        diagnostics.push({
          line: lineNumber,
          message: `Unsupported subgraph syntax: ${line}`,
        });
        continue;
      }
      subgraphs.push({
        ...parsed,
        parentKey: currentSubgraphKey(),
        depth: subgraphStack.length,
        nodeIds: new Set<string>(),
      });
      subgraphStack.push(parsed.key);
      continue;
    }

    if (mode === "graph" && line === "end") {
      if (subgraphStack.length === 0) {
        diagnostics.push({
          line: lineNumber,
          message: "Found 'end' without a matching subgraph.",
        });
        continue;
      }
      subgraphStack.pop();
      continue;
    }

    if (mode === "graph") {
      const edgeMatch =
        line.match(/^(\w+)\s*-->\|([^|]*)\|\s*(\w+)$/) ||
        line.match(/^(\w+)\s*-->\s*(\w+)$/);

      if (edgeMatch) {
        let source: string;
        let target: string;
        let label = "";

        if (edgeMatch.length === 4) {
          source = edgeMatch[1];
          label = decodeMermaidText(edgeMatch[2]);
          target = edgeMatch[3];
        } else {
          source = edgeMatch[1];
          target = edgeMatch[2];
        }

        const existingEdge = takeExistingEdge(existingEdgeBuckets, source, target, label);
        const occurrenceKey = `${source}|${target}|${label}`;
        const occurrence = (edgeOccurrenceByKey.get(occurrenceKey) ?? 0) + 1;
        edgeOccurrenceByKey.set(occurrenceKey, occurrence);
        const edgeId = existingEdge?.id ?? makeStableEdgeId(source, target, label || undefined, occurrence);
        const baseData = existingEdge?.data ?? {};

        edges.push({
          ...(existingEdge ?? {
            id: edgeId,
            source,
            target,
            type: "smoothstep",
            animated: false,
            data: {},
          }),
          id: edgeId,
          source,
          target,
          label: label || undefined,
          data: {
            ...baseData,
            label: label || undefined,
          },
        });

        for (const nodeId of [source, target]) {
          if (nodeSet.has(nodeId)) {
            trackNodeInCurrentSubgraph(nodeId);
            continue;
          }

          nodeSet.add(nodeId);
          const existingNode = existingNodes.get(nodeId);
          nodes.push(makeArchNode(nodeId, nodeId, "service", existingNode));
          trackNodeInCurrentSubgraph(nodeId);
        }
        continue;
      }

      const parsedNode = parseNodeDefinition(line);
      if (parsedNode) {
        if (!nodeSet.has(parsedNode.id)) {
          nodeSet.add(parsedNode.id);
          nodes.push(
            makeArchNode(
              parsedNode.id,
              parsedNode.label,
              parsedNode.inferredShapeType,
              existingNodes.get(parsedNode.id)
            )
          );
        }
        trackNodeInCurrentSubgraph(parsedNode.id);
        continue;
      }

      diagnostics.push({
        line: lineNumber,
        message: `Unsupported flowchart syntax: ${line}`,
      });
      continue;
    }

    if (mode === "erDiagram") {
      const tableOpen = line.match(/^(\w+)\s*\{$/);
      if (tableOpen) {
        flushErTable();
        currentErTable = tableOpen[1];
        currentErColumns = [];
        continue;
      }

      if (line === "}") {
        flushErTable();
        continue;
      }

      if (currentErTable) {
        const columnMatch = line.match(/^(\w+)\s+(\w+)(?:\s+(PRIMARY|FOREIGN|UNIQUE|NULLABLE|PK|FK|UQ))?$/i);
        if (columnMatch) {
          const constraintMap: Record<string, SchemaColumn["constraint"]> = {
            PRIMARY: "primary",
            PK: "primary",
            FOREIGN: "foreign",
            FK: "foreign",
            UNIQUE: "unique",
            UQ: "unique",
            NULLABLE: "nullable",
          };
          currentErColumns.push({
            type: columnMatch[1],
            name: columnMatch[2],
            constraint: columnMatch[3] ? constraintMap[columnMatch[3].toUpperCase()] : undefined,
          });
          continue;
        }
      }

      const relationMatch = line.match(
        /^(\w+)\s+(\|\|--|--\|\||--o\{|o\{--|--\|o|\|\|--o\{|\}o--\|\||\|\|--\|\|)\s+(\w+)\s*:\s*"?([^"]*)"?$/
      );
      if (relationMatch) {
        flushErTable();
        const sourceName = relationMatch[1];
        const targetName = relationMatch[3];
        const label = decodeMermaidText(relationMatch[4]);

        for (const tableName of [sourceName, targetName]) {
          const existingId = findTableNodeId(tableName, existingNodes);
          const tableId =
            existingId ??
            `table_${sanitizeErName(tableName).toLowerCase() || "table"}_${Math.random()
              .toString(36)
              .slice(2, 10)}`;
          if (!nodeSet.has(tableId)) {
            nodeSet.add(tableId);
            const existingNode = existingId ? existingNodes.get(existingId) : undefined;
            nodes.push({
              ...(existingNode ?? {
                id: tableId,
                type: "databaseSchemaNode",
                position: { x: 0, y: 0 },
                data: {},
              }),
              id: tableId,
              type: "databaseSchemaNode",
              data: {
                ...(existingNode?.data ?? {}),
                label: tableName,
                schema: existingNode?.data.schema ?? [],
              },
            });
          }
        }

        const sourceId = findTableNodeIdFromNodes(sourceName, nodes) ?? sourceName;
        const targetId = findTableNodeIdFromNodes(targetName, nodes) ?? targetName;
        const existingEdge = takeExistingEdge(existingEdgeBuckets, sourceId, targetId, label);
        const occurrenceKey = `${sourceId}|${targetId}|${label}`;
        const occurrence = (edgeOccurrenceByKey.get(occurrenceKey) ?? 0) + 1;
        edgeOccurrenceByKey.set(occurrenceKey, occurrence);
        const edgeId = existingEdge?.id ?? makeStableEdgeId(sourceId, targetId, label || undefined, occurrence);

        edges.push({
          ...(existingEdge ?? {
            id: edgeId,
            source: sourceId,
            target: targetId,
            type: "smoothstep",
            animated: false,
            data: {},
          }),
          id: edgeId,
          source: sourceId,
          target: targetId,
          label: label || undefined,
          data: {
            ...(existingEdge?.data ?? {}),
            label: label || undefined,
          },
        });
        continue;
      }

      diagnostics.push({
        line: lineNumber,
        message: `Unsupported ER syntax: ${line}`,
      });
      continue;
    }

    diagnostics.push({
      line: lineNumber,
      message: `Unsupported Mermaid section: ${line}`,
    });
  }

  flushErTable();

  if (subgraphStack.length > 0) {
    diagnostics.push({
      line: lines[lines.length - 1]?.lineNumber ?? 1,
      message: "One or more Mermaid subgraphs are missing an 'end' line.",
    });
  }

  if (diagnostics.length > 0) {
    throw new MermaidParseError("Mermaid contains unsupported or invalid syntax.", diagnostics);
  }

  return {
    nodes,
    edges,
    subgraphs: subgraphs.map((subgraph) => ({
      ...subgraph,
      nodeIds: [...subgraph.nodeIds],
    })),
    diagnostics,
  };
}

export function validateMermaidDocument(mermaid: string): MermaidDiagnostic[] {
  try {
    const result = mermaidToFlow(mermaid);
    return result.diagnostics;
  } catch (error) {
    if (error instanceof MermaidParseError) {
      return error.diagnostics;
    }
    throw error;
  }
}

