import { mermaidToFlow } from "./mermaid.js";
import type { DiagramDocument, DiagramNodeRecord } from "./domain.js";

function escapeMermaidQuotedText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function sanitizeMermaidEdgeLabel(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "/").trim();
}

function sanitizeErToken(value: string, fallback: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_[\](),.-]/g, "");
  return cleaned || fallback;
}

function escapeErQuotedText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '\\"');
}

function ensureErDiagramBlock(code: string): string {
  if (code.includes("erDiagram")) return code;
  return `${code.trimEnd()}\n\nerDiagram\n`;
}

function appendLineToDiagram(
  code: string,
  line: string,
  shouldInsertBefore: (trimmedLine: string) => boolean
): string {
  const lines = code.split("\n");
  let insertIdx = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (shouldInsertBefore(lines[i].trim())) {
      insertIdx = i;
    } else {
      break;
    }
  }
  lines.splice(insertIdx, 0, line);
  return lines.join("\n");
}

export function rebuildGraphFromMermaid(
  diagram: DiagramDocument,
  mermaidCode: string
): DiagramDocument {
  const nextGraph = mermaidToFlow(mermaidCode, {
    nodes: diagram.nodes,
    edges: diagram.edges,
  });

  return {
    ...diagram,
    mermaidCode,
    nodes: nextGraph.nodes,
    edges: nextGraph.edges,
  };
}

export function appendDiagramNode(
  diagram: DiagramDocument,
  input: {
    nodeId: string;
    label: string;
    shapeType: string;
    description?: string;
  }
): DiagramDocument {
  const fullLabel = input.description ? `${input.label} - ${input.description}` : input.label;
  const safeLabel = escapeMermaidQuotedText(fullLabel);
  const shapeMap: Record<string, (id: string, label: string) => string> = {
    service: (id, label) => `${id}["${label}"]`,
    database: (id, label) => `${id}[("${label}")]`,
    gateway: (id, label) => `${id}(["${label}"])`,
    queue: (id, label) => `${id}{{"${label}"}}`,
    client: (id, label) => `${id}(["${label}"])`,
    cloud: (id, label) => `${id}["${label}"]`,
    cache: (id, label) => `${id}{"${label}"}`,
    storage: (id, label) => `${id}[("${label}")]`,
    function: (id, label) => `${id}[/"${label}"\\]`,
    container: (id, label) => `${id}["${label}"]`,
    custom: (id, label) => `${id}["${label}"]`,
  };

  const formatter = shapeMap[input.shapeType] ?? shapeMap.service;
  const nodeLine = `    ${formatter(input.nodeId, safeLabel)}`;
  const nextCode = appendLineToDiagram(diagram.mermaidCode, nodeLine, (trimmed) => {
    return trimmed.startsWith("style ") || trimmed.includes("-->") || trimmed === "";
  });

  return rebuildGraphFromMermaid(
    { ...diagram, updatedAt: new Date().toISOString() },
    nextCode
  );
}

export function appendDiagramEdge(
  diagram: DiagramDocument,
  input: {
    source: string;
    target: string;
    label?: string;
  }
): DiagramDocument {
  const safeEdgeLabel = input.label ? sanitizeMermaidEdgeLabel(input.label) : "";
  const edgeLine = safeEdgeLabel
    ? `    ${input.source} -->|${safeEdgeLabel}| ${input.target}`
    : `    ${input.source} --> ${input.target}`;

  const nextCode = appendLineToDiagram(diagram.mermaidCode, edgeLine, (trimmed) => {
    return trimmed.startsWith("style ");
  });

  return rebuildGraphFromMermaid(
    { ...diagram, updatedAt: new Date().toISOString() },
    nextCode
  );
}

function sanitizeErTableName(value: string, fallback: string): string {
  return value.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || fallback;
}

function buildErTableBlock(table: {
  name: string;
  columns: Array<{ name: string; type: string; constraint?: "primary" | "foreign" | "unique" | "nullable" }>;
}): string[] {
  const safeName = sanitizeErTableName(table.name, "table");
  const lines: string[] = [`    ${safeName} {`];
  for (const column of table.columns) {
    const safeType = sanitizeErToken(column.type, "string");
    const safeColumnName = sanitizeErToken(column.name, "column");
    const constraintStr = column.constraint ? ` ${column.constraint.toUpperCase()}` : "";
    lines.push(`        ${safeType} ${safeColumnName}${constraintStr}`);
  }
  lines.push("    }");
  return lines;
}

function buildErRelationshipLine(input: {
  from: string;
  to: string;
  label: string;
  cardinality?: "one-to-one" | "one-to-many" | "many-to-many";
}): string {
  const cardinalityMap: Record<string, string> = {
    "one-to-one": "||--||",
    "one-to-many": "||--o{",
    "many-to-many": "}o--o{",
  };
  const from = sanitizeErTableName(input.from, "from_table");
  const to = sanitizeErTableName(input.to, "to_table");
  const card = cardinalityMap[input.cardinality ?? "one-to-many"] ?? "||--o{";
  return `    ${from} ${card} ${to} : "${escapeErQuotedText(input.label)}"`;
}

export function buildDatabaseSchemaMermaid(input: {
  tables: Array<{
    name: string;
    columns: Array<{ name: string; type: string; constraint?: "primary" | "foreign" | "unique" | "nullable" }>;
  }>;
  relationships?: Array<{
    from: string;
    to: string;
    label: string;
    cardinality?: "one-to-one" | "one-to-many" | "many-to-many";
  }>;
}): string {
  const lines: string[] = ["erDiagram"];
  for (const table of input.tables) {
    lines.push(...buildErTableBlock(table));
  }

  for (const relationship of input.relationships ?? []) {
    lines.push(buildErRelationshipLine(relationship));
  }

  return `${lines.join("\n")}\n`;
}

export function appendErTable(
  diagram: DiagramDocument,
  table: {
    name: string;
    columns: Array<{ name: string; type: string; constraint?: "primary" | "foreign" | "unique" | "nullable" }>;
  }
): DiagramDocument {
  const tableLines = buildErTableBlock(table);
  const lines = ensureErDiagramBlock(diagram.mermaidCode).split("\n");
  let insertIdx = lines.length;
  const erIdx = lines.findIndex((line) => line.trim() === "erDiagram");
  if (erIdx !== -1) {
    for (let i = erIdx + 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (
        trimmed.includes("||--") ||
        trimmed.includes("}o--") ||
        trimmed.includes("--o{") ||
        trimmed.includes("--||")
      ) {
        insertIdx = i;
        break;
      }
    }
  }

  lines.splice(insertIdx, 0, ...tableLines);
  return rebuildGraphFromMermaid(
    { ...diagram, updatedAt: new Date().toISOString() },
    lines.join("\n")
  );
}

export function appendErRelationship(
  diagram: DiagramDocument,
  relationship: {
    from: string;
    to: string;
    label: string;
    cardinality?: "one-to-one" | "one-to-many" | "many-to-many";
  }
): DiagramDocument {
  const relationshipLine = buildErRelationshipLine(relationship);
  const lines = ensureErDiagramBlock(diagram.mermaidCode).split("\n");
  let insertIdx = lines.length;
  const erIdx = lines.findIndex((line) => line.trim() === "erDiagram");
  if (erIdx !== -1) {
    for (let i = lines.length - 1; i >= erIdx; i--) {
      if (lines[i].trim().startsWith("style ")) {
        insertIdx = i;
      } else if (lines[i].trim().length > 0 && i > erIdx) {
        insertIdx = i + 1;
        break;
      }
    }
  }

  lines.splice(insertIdx, 0, relationshipLine);
  return rebuildGraphFromMermaid(
    { ...diagram, updatedAt: new Date().toISOString() },
    lines.join("\n")
  );
}
