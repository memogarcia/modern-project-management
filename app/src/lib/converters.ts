import type { ArchNode, ArchEdge, ShapeType, DiagramNode, DatabaseSchemaNodeData, SchemaColumn } from "@/lib/types";

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
  if (archNodes.length > 0 || (schemaNodes.length === 0 && edges.length === 0)) {
    lines.push("graph TD");
    for (const node of archNodes) {
      const label = node.data.label ?? node.id;
      lines.push(`    ${node.id}["${label}"]`);
    }

    if (edges.length > 0 && archNodes.length > 0) {
      lines.push("");
      const archIds = new Set(archNodes.map((n) => n.id));
      for (const edge of edges) {
        if (!archIds.has(edge.source) && !archIds.has(edge.target)) continue;
        const label = edge.data?.label ?? edge.label;
        if (label) {
          lines.push(`    ${edge.source} -->|${label}| ${edge.target}`);
        } else {
          lines.push(`    ${edge.source} --> ${edge.target}`);
        }
      }
    }
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
        const label = edge.data?.label ?? edge.label ?? "relates";
        lines.push(`    ${src} ||--o{ ${tgt} : "${label}"`);
      }
    }
  }

  return (lines.length > 0 ? lines.join("\n") : "graph TD") + "\n";
}

function sanitizeErName(name: string): string {
  return name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
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
} {
  const nodes: DiagramNode[] = [];
  const edges: ArchEdge[] = [];
  const nodeSet = new Set<string>();

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
    if (line.startsWith("%%") || line.startsWith("style")) continue;

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
          id: `e-${source}-${target}`,
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
          }
        }
        continue;
      }

      // Node definitions
      const nodeParsed = parseNodeDefinition(line);
      if (nodeParsed && !nodeSet.has(nodeParsed.id)) {
        nodeSet.add(nodeParsed.id);
        nodes.push(makeNode(nodeParsed.id, nodeParsed.label, existingMap.get(nodeParsed.id) as ArchNode | undefined));
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
          id: `e-${srcId}-${tgtId}`,
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

  return { nodes, edges };
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

function parseNodeDefinition(
  line: string
): { id: string; label: string } | null {
  // cylinder: id[("label")]
  let m = line.match(/^(\w+)\[\("([^"]+)"\)\]/);
  if (m) return { id: m[1], label: m[2] };

  // stadium: id(["label"])
  m = line.match(/^(\w+)\(\["([^"]+)"\]\)/);
  if (m) return { id: m[1], label: m[2] };

  // hexagon: id{{"label"}}
  m = line.match(/^(\w+)\{\{"([^"]+)"\}\}/);
  if (m) return { id: m[1], label: m[2] };

  // circle: id(("label"))
  m = line.match(/^(\w+)\(\("([^"]+)"\)\)/);
  if (m) return { id: m[1], label: m[2] };

  // diamond: id{"label"}
  m = line.match(/^(\w+)\{"([^"]+)"\}/);
  if (m) return { id: m[1], label: m[2] };

  // trapezoid: id[/"label"\]
  m = line.match(/^(\w+)\[\/"([^"]+)"\\]/);
  if (m) return { id: m[1], label: m[2] };

  // rect: id["label"]
  m = line.match(/^(\w+)\["([^"]+)"\]/);
  if (m) return { id: m[1], label: m[2] };

  // simple: id(label)
  m = line.match(/^(\w+)\(([^)]+)\)/);
  if (m) return { id: m[1], label: m[2] };

  return null;
}

/**
 * Create a node, preserving visual metadata from an existing node if available.
 * New nodes default to shapeType "service".
 */
function makeNode(id: string, label: string, existing?: ArchNode): ArchNode {
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
      shapeType: "service",
    },
  };
}
