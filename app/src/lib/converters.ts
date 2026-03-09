import type { ArchNode, ArchEdge, ShapeType, DiagramNode, DatabaseSchemaNodeData, SchemaColumn } from "@/lib/types";

type MermaidArchGroup = "clients" | "edge" | "app" | "async" | "data" | "other";

const ARCH_GROUP_LABELS: Record<MermaidArchGroup, string> = {
  clients: "Clients",
  edge: "Edge & Entry",
  app: "Application",
  async: "Messaging & Async",
  data: "Data Stores",
  other: "Components",
};

const SHAPE_TO_ARCH_GROUP: Record<ShapeType, MermaidArchGroup> = {
  client: "clients",
  gateway: "edge",
  cloud: "edge",
  service: "app",
  container: "app",
  function: "app",
  queue: "async",
  cache: "async",
  database: "data",
  storage: "data",
  custom: "other",
};

const SHAPE_TO_MERMAID_CLASS: Record<ShapeType, string> = {
  client: "clientNode",
  gateway: "edgeNode",
  cloud: "edgeNode",
  service: "serviceNode",
  container: "serviceNode",
  function: "serviceNode",
  queue: "asyncNode",
  cache: "asyncNode",
  database: "dataNode",
  storage: "dataNode",
  custom: "otherNode",
};

const MERMAID_CLASS_DEFS: Array<[string, string]> = [
  ["clientNode", "fill:#e0f7fa,stroke:#0891b2,stroke-width:2px,color:#0f172a"],
  ["edgeNode", "fill:#f1f5f9,stroke:#64748b,stroke-width:2px,color:#0f172a"],
  ["serviceNode", "fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#0f172a"],
  ["asyncNode", "fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#0f172a"],
  ["dataNode", "fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#0f172a"],
  ["otherNode", "fill:#e5e7eb,stroke:#6b7280,stroke-width:2px,color:#111827"],
];

export interface MermaidSubgraph {
  key: string;
  id: string;
  label: string;
  parentKey: string | null;
  depth: number;
  order: number;
  nodeIds: string[];
}

// ─── Flow → Mermaid ─────────────────────────────────────────────────
// Mermaid is kept simple: just structure (nodes + edges).
// Visual metadata (colors, shapes, icons) lives on the diagram side only.
// If any databaseSchemaNode exists we emit an erDiagram block after the
// main graph block so Mermaid can render ER diagrams alongside arch diagrams.
export function flowToMermaid(nodes: DiagramNode[], edges: ArchEdge[]): string {
  const archNodes = nodes.filter((n) => n.type === "archNode") as ArchNode[];
  const schemaNodes = nodes.filter((n) => n.type === "databaseSchemaNode") as Array<
    DiagramNode & { data: DatabaseSchemaNodeData }
  >;

  const lines: string[] = [];

  // ─── Architecture graph section ──────────────────────────────────
  if (archNodes.length > 0) {
    lines.push(
      "%%{init: {\"theme\":\"base\", \"flowchart\": {\"curve\":\"stepBefore\", \"nodeSpacing\": 42, \"rankSpacing\": 70, \"useMaxWidth\": false}}}%%"
    );
    lines.push("flowchart LR");

    const groupedNodes = groupArchNodes(archNodes);
    for (const [group, nodesInGroup] of groupedNodes) {
      if (nodesInGroup.length === 0) continue;
      lines.push(`    subgraph ${group}["${ARCH_GROUP_LABELS[group]}"]`);
      for (const node of nodesInGroup) {
        lines.push(`        ${formatArchNodeForMermaid(node)}`);
      }
      lines.push("    end");
    }

    lines.push("");
    const archIds = new Set(archNodes.map((n) => n.id));
    for (const edge of edges) {
      if (!archIds.has(edge.source) || !archIds.has(edge.target)) continue;
      const rawLabel = edge.data?.label ?? edge.label;
      if (rawLabel) {
        const label = typeof rawLabel === "string" ? rawLabel : String(rawLabel);
        lines.push(`    ${edge.source} -->|${escapeMermaidText(label)}| ${edge.target}`);
      } else {
        lines.push(`    ${edge.source} --> ${edge.target}`);
      }
    }

    lines.push("");
    for (const [className, style] of MERMAID_CLASS_DEFS) {
      lines.push(`    classDef ${className} ${style};`);
    }

    const classAssignments = new Map<string, string[]>();
    for (const node of archNodes) {
      const className = SHAPE_TO_MERMAID_CLASS[node.data.shapeType ?? "service"];
      if (!classAssignments.has(className)) classAssignments.set(className, []);
      classAssignments.get(className)!.push(node.id);
    }
    for (const [className, nodeIds] of classAssignments) {
      if (nodeIds.length > 0) {
        lines.push(`    class ${nodeIds.join(",")} ${className};`);
      }
    }
    lines.push("    linkStyle default stroke:#64748b,stroke-width:1.8px;");
  } else if (schemaNodes.length === 0 && edges.length === 0) {
    // Preserve the existing empty-diagram default to avoid sync loops and
    // keep the new diagram experience unchanged.
    lines.push("graph TD");
  }

  // ─── ER Diagram section ──────────────────────────────────────────
  if (schemaNodes.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("erDiagram");
    for (const node of schemaNodes) {
      const tableName = sanitizeErName(node.data.label);
      const cols: SchemaColumn[] = node.data.schema ?? [];
      if (cols.length > 0) {
        lines.push(`    ${tableName} {`);
        for (const col of cols) {
          const constraintStr = col.constraint ? ` ${col.constraint.toUpperCase()}` : "";
          lines.push(`        ${col.type} ${col.name}${constraintStr}`);
        }
        lines.push("    }");
      } else {
        lines.push(`    ${tableName} {`);
        lines.push("    }");
      }
    }

    // ER relationships from edges between schema nodes
    const schemaIds = new Set(schemaNodes.map((n) => n.id));
    for (const edge of edges) {
      if (schemaIds.has(edge.source) && schemaIds.has(edge.target)) {
        const src = sanitizeErName(
          (schemaNodes.find((n) => n.id === edge.source) as { data: DatabaseSchemaNodeData })
            ?.data.label ?? edge.source
        );
        const tgt = sanitizeErName(
          (schemaNodes.find((n) => n.id === edge.target) as { data: DatabaseSchemaNodeData })
            ?.data.label ?? edge.target
        );
        const rawLabel = edge.data?.label ?? edge.label ?? "relates";
        const label = typeof rawLabel === "string" ? rawLabel : String(rawLabel);
        lines.push(`    ${src} ||--o{ ${tgt} : "${escapeMermaidText(label)}"`);
      }
    }
  }

  return (lines.length > 0 ? lines.join("\n") : "graph TD") + "\n";
}

function sanitizeErName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
}

function escapeMermaidText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function makeMermaidEdgeId(
  source: string,
  target: string,
  label: string | undefined,
  counts: Map<string, number>
): string {
  const normalizedLabel = (label ?? "").trim();
  const key = `${source}|${target}|${normalizedLabel}`;
  const occurrence = (counts.get(key) ?? 0) + 1;
  counts.set(key, occurrence);

  const labelToken = normalizedLabel ? hashLabelToken(normalizedLabel) : "nolabel";
  return `e-${source}-${target}-${labelToken}-${occurrence}`;
}

function hashLabelToken(value: string): string {
  // Compact stable token so edge ids don't collide when parallel edges share endpoints.
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function groupArchNodes(nodes: ArchNode[]): Array<[MermaidArchGroup, ArchNode[]]> {
  const order: MermaidArchGroup[] = ["clients", "edge", "app", "async", "data", "other"];
  const buckets = new Map<MermaidArchGroup, ArchNode[]>(
    order.map((group) => [group, []])
  );

  for (const node of nodes) {
    const group = SHAPE_TO_ARCH_GROUP[node.data.shapeType ?? "service"] ?? "other";
    buckets.get(group)!.push(node);
  }

  return order.map((group) => [group, buckets.get(group)!]);
}

function formatArchNodeForMermaid(node: ArchNode): string {
  const label = escapeMermaidText(node.data.label ?? node.id);
  const shapeType = node.data.shapeType ?? "service";

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

// ─── Mermaid → Flow ─────────────────────────────────────────────────
// Parse simple Mermaid into nodes/edges.
// Pass existingNodes so that shape types and other visual metadata are preserved
// for nodes that already exist on the canvas.
export function mermaidToFlow(
  mermaid: string,
  existingNodes?: DiagramNode[],
): {
  nodes: DiagramNode[];
  edges: ArchEdge[];
  subgraphs: MermaidSubgraph[];
} {
  const nodes: DiagramNode[] = [];
  const edges: ArchEdge[] = [];
  const nodeSet = new Set<string>();
  const edgeIdCounts = new Map<string, number>();
  const subgraphs: Array<Omit<MermaidSubgraph, "nodeIds"> & { nodeIds: Set<string> }> = [];
  const subgraphStack: string[] = [];
  let subgraphOrder = 0;
  const nodeSubgraphKeyByNodeId = new Map<string, string>();

  // Build a lookup of existing node data by id
  const existingMap = new Map<string, DiagramNode>();
  if (existingNodes) {
    for (const n of existingNodes) {
      existingMap.set(n.id, n);
    }
  }

  const lines = mermaid.split("\n").map((l) => l.trim()).filter(Boolean);

  // Detect sections
  let mode: "graph" | "erDiagram" | null = null;
  let currentErTable: string | null = null;
  let currentErColumns: SchemaColumn[] = [];

  function flushErTable() {
    if (currentErTable) {
      const tableId = findTableNodeId(currentErTable, existingMap) ?? `table_${currentErTable.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`;
      if (!nodeSet.has(tableId)) {
        nodeSet.add(tableId);
        const existing = existingMap.get(tableId);
        if (existing && existing.type === "databaseSchemaNode") {
          nodes.push({
            ...existing,
            data: {
              ...existing.data,
              label: currentErTable,
              schema: currentErColumns,
            },
          } as DiagramNode);
        } else {
          nodes.push({
            id: tableId,
            type: "databaseSchemaNode",
            position: { x: 0, y: 0 },
            data: {
              label: currentErTable,
              schema: currentErColumns,
            },
          } as DiagramNode);
        }
      }
      currentErTable = null;
      currentErColumns = [];
    }
  }

  function currentSubgraphKey(): string | null {
    return subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1] : null;
  }

  function trackNodeInCurrentSubgraph(nodeId: string) {
    const currentKey = currentSubgraphKey();
    if (!currentKey) return;
    if (nodeSubgraphKeyByNodeId.has(nodeId)) return;
    nodeSubgraphKeyByNodeId.set(nodeId, currentKey);
    const sg = subgraphs.find((s) => s.key === currentKey);
    if (sg) sg.nodeIds.add(nodeId);
  }

  for (const line of lines) {
    // Section headers
    if (line.startsWith("graph") || line.startsWith("flowchart")) {
      mode = "graph";
      continue;
    }
    if (line === "erDiagram") {
      flushErTable();
      mode = "erDiagram";
      continue;
    }
    if (mode === "graph" && line.startsWith("subgraph")) {
      const parsedSubgraph = parseSubgraphDefinition(line, subgraphOrder++);
      if (parsedSubgraph) {
        subgraphs.push({
          ...parsedSubgraph,
          parentKey: currentSubgraphKey(),
          depth: subgraphStack.length,
          nodeIds: new Set<string>(),
        });
        subgraphStack.push(parsedSubgraph.key);
      }
      continue;
    }
    if (mode === "graph" && line === "end") {
      if (subgraphStack.length > 0) subgraphStack.pop();
      continue;
    }
    if (
      line.startsWith("%%") ||
      line.startsWith("style") ||
      line.startsWith("classDef") ||
      line.startsWith("class ") ||
      line.startsWith("linkStyle")
    ) continue;

    if (mode === "graph") {
      // Edges: A -->|label| B  or  A --> B
      const edgeMatch =
        line.match(/^(\w+)\s*-->\|([^|]*)\|\s*(\w+)$/) ||
        line.match(/^(\w+)\s*-->\s*(\w+)$/);

      if (edgeMatch) {
        let source: string, target: string, label: string | undefined;
        if (edgeMatch.length === 4) {
          source = edgeMatch[1];
          label = edgeMatch[2];
          target = edgeMatch[3];
        } else {
          source = edgeMatch[1];
          target = edgeMatch[2];
        }

        edges.push({
          id: makeMermaidEdgeId(source, target, label, edgeIdCounts),
          source,
          target,
          label: label || undefined,
          data: label ? { label } : undefined,
          type: "smoothstep",
          animated: false,
        });

        // Ensure source and target nodes exist
        for (const nid of [source, target]) {
          if (!nodeSet.has(nid)) {
            nodeSet.add(nid);
            nodes.push(makeNode(nid, nid, existingMap.get(nid) as ArchNode | undefined));
            trackNodeInCurrentSubgraph(nid);
          } else {
            trackNodeInCurrentSubgraph(nid);
          }
        }
        continue;
      }

      // Node definitions
      const nodeParsed = parseNodeDefinition(line);
      if (nodeParsed && !nodeSet.has(nodeParsed.id)) {
        nodeSet.add(nodeParsed.id);
        nodes.push(
          makeNode(
            nodeParsed.id,
            nodeParsed.label,
            existingMap.get(nodeParsed.id) as ArchNode | undefined,
            nodeParsed.inferredShapeType
          )
        );
        trackNodeInCurrentSubgraph(nodeParsed.id);
      }
    } else if (mode === "erDiagram") {
      // ER table open: TABLE_NAME {
      const tableOpen = line.match(/^(\w+)\s*\{$/);
      if (tableOpen) {
        flushErTable();
        currentErTable = tableOpen[1];
        currentErColumns = [];
        continue;
      }

      // Closing brace
      if (line === "}") {
        flushErTable();
        continue;
      }

      // Column inside a table: type name [CONSTRAINT]
      if (currentErTable) {
        const colMatch = line.match(/^(\w+)\s+(\w+)(?:\s+(PRIMARY|FOREIGN|UNIQUE|NULLABLE|PK|FK|UQ))?$/i);
        if (colMatch) {
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
            type: colMatch[1],
            name: colMatch[2],
            constraint: colMatch[3] ? constraintMap[colMatch[3].toUpperCase()] : undefined,
          });
          continue;
        }
      }

      // ER relationship: TABLE1 ||--o{ TABLE2 : "label"
      const relMatch = line.match(
        /^(\w+)\s+(\|\|--|--\|\||--o\{|o\{--|--\|o|\|\|--o\{|\}o--\|\||\|\|--\|\|)\s+(\w+)\s*:\s*"?([^"]*)"?$/
      );
      if (relMatch) {
        flushErTable();
        const srcName = relMatch[1];
        const tgtName = relMatch[3];
        const label = relMatch[4];

        // Ensure both table nodes exist
        for (const tName of [srcName, tgtName]) {
          const tid = findTableNodeId(tName, existingMap) ?? `table_${tName.toLowerCase()}_${Math.random().toString(36).slice(2, 10)}`;
          if (!nodeSet.has(tid)) {
            nodeSet.add(tid);
            const existing = existingMap.get(tid);
            if (existing && existing.type === "databaseSchemaNode") {
              nodes.push(existing);
            } else {
              nodes.push({
                id: tid,
                type: "databaseSchemaNode",
                position: { x: 0, y: 0 },
                data: { label: tName, schema: [] },
              } as DiagramNode);
            }
          }
        }

        const srcId = findTableNodeIdFromNodes(srcName, nodes) ?? srcName;
        const tgtId = findTableNodeIdFromNodes(tgtName, nodes) ?? tgtName;

        edges.push({
          id: makeMermaidEdgeId(srcId, tgtId, label, edgeIdCounts),
          source: srcId,
          target: tgtId,
          label: label || undefined,
          data: label ? { label } : undefined,
          type: "smoothstep",
          animated: false,
        });
        continue;
      }
    }
  }

  // Flush any remaining open table
  flushErTable();

  return {
    nodes,
    edges,
    subgraphs: subgraphs.map((sg) => ({
      ...sg,
      nodeIds: [...sg.nodeIds],
    })),
  };
}

/**
 * Find a table node ID from existing nodes by table name.
 */
function findTableNodeId(tableName: string, existingMap: Map<string, DiagramNode>): string | null {
  for (const [id, node] of existingMap) {
    if (
      node.type === "databaseSchemaNode" &&
      sanitizeErName((node.data as DatabaseSchemaNodeData).label) === tableName
    ) {
      return id;
    }
  }
  return null;
}

function findTableNodeIdFromNodes(tableName: string, nodes: DiagramNode[]): string | null {
  for (const node of nodes) {
    if (
      node.type === "databaseSchemaNode" &&
      sanitizeErName((node.data as DatabaseSchemaNodeData).label) === tableName
    ) {
      return node.id;
    }
  }
  return null;
}

type ParsedNodeDefinition = {
  id: string;
  label: string;
  inferredShapeType: ShapeType;
};

type ParsedSubgraphDefinition = {
  key: string;
  id: string;
  label: string;
  order: number;
};

function parseNodeDefinition(
  line: string
): ParsedNodeDefinition | null {
  // cylinder: id[("label")]
  let m = line.match(/^(\w+)\[\("([^"]+)"\)\]/);
  if (m) return buildParsedNode(m[1], m[2], "cylinder");

  // stadium: id(["label"])
  m = line.match(/^(\w+)\(\["([^"]+)"\]\)/);
  if (m) return buildParsedNode(m[1], m[2], "stadium");

  // hexagon: id{{"label"}}
  m = line.match(/^(\w+)\{\{"([^"]+)"\}\}/);
  if (m) return buildParsedNode(m[1], m[2], "hexagon");

  // circle: id(("label"))
  m = line.match(/^(\w+)\(\("([^"]+)"\)\)/);
  if (m) return buildParsedNode(m[1], m[2], "circle");

  // diamond: id{"label"}
  m = line.match(/^(\w+)\{"([^"]+)"\}/);
  if (m) return buildParsedNode(m[1], m[2], "diamond");

  // trapezoid: id[/"label"\]
  m = line.match(/^(\w+)\[\/"([^"]+)"\\]/);
  if (m) return buildParsedNode(m[1], m[2], "trapezoid");

  // rect: id["label"]
  m = line.match(/^(\w+)\["([^"]+)"\]/);
  if (m) return buildParsedNode(m[1], m[2], "rect");

  // simple: id(label)
  m = line.match(/^(\w+)\(([^)]+)\)/);
  if (m) return buildParsedNode(m[1], m[2], "simple");

  return null;
}

function parseSubgraphDefinition(
  line: string,
  order: number
): ParsedSubgraphDefinition | null {
  // Common forms:
  // subgraph id["Label"]
  // subgraph id[Label]
  // subgraph id Label
  // subgraph "Label"
  // subgraph Label
  let m = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*\["([^"]+)"\]\s*$/);
  if (m) {
    return buildParsedSubgraph(m[1], m[1], decodeMermaidText(m[2]), order);
  }

  m = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s*\[([^\]]+)\]\s*$/);
  if (m) {
    return buildParsedSubgraph(m[1], m[1], decodeMermaidText(m[2]), order);
  }

  m = line.match(/^subgraph\s+([A-Za-z0-9_]+)\s+(.+)\s*$/);
  if (m) {
    return buildParsedSubgraph(m[1], m[1], decodeMermaidText(stripWrappingQuotes(m[2])), order);
  }

  m = line.match(/^subgraph\s+"([^"]+)"\s*$/);
  if (m) {
    const label = decodeMermaidText(m[1]);
    const id = sanitizeSubgraphId(label) || `subgraph_${order + 1}`;
    return buildParsedSubgraph(id, id, label, order);
  }

  m = line.match(/^subgraph\s+(.+)\s*$/);
  if (m) {
    const label = decodeMermaidText(stripWrappingQuotes(m[1]));
    const id = sanitizeSubgraphId(label) || `subgraph_${order + 1}`;
    return buildParsedSubgraph(id, id, label, order);
  }

  return null;
}

function buildParsedSubgraph(id: string, keySeed: string, label: string, order: number): ParsedSubgraphDefinition {
  return {
    id,
    key: `${sanitizeSubgraphId(keySeed) || "subgraph"}_${order + 1}`,
    label,
    order,
  };
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

type MermaidNodeSyntax =
  | "cylinder"
  | "stadium"
  | "hexagon"
  | "circle"
  | "diamond"
  | "trapezoid"
  | "rect"
  | "simple";

function buildParsedNode(id: string, rawLabel: string, syntax: MermaidNodeSyntax): ParsedNodeDefinition {
  const label = decodeMermaidText(rawLabel);
  return {
    id,
    label,
    inferredShapeType: inferShapeTypeFromMermaidSyntax(syntax, label),
  };
}

function decodeMermaidText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function inferShapeTypeFromMermaidSyntax(syntax: MermaidNodeSyntax, label: string): ShapeType {
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

/**
 * Create a node, preserving visual metadata from an existing node if available.
 * New nodes default to shapeType "service".
 */
function makeNode(
  id: string,
  label: string,
  existing?: ArchNode,
  inferredShapeType: ShapeType = "service"
): ArchNode {
  if (existing) {
    return {
      ...existing,
      data: {
        ...existing.data,
        label, // update label from Mermaid
      },
    };
  }
  return {
    id,
    type: "archNode",
    position: { x: 0, y: 0 },
    data: {
      label,
      shapeType: inferredShapeType,
    },
  };
}
