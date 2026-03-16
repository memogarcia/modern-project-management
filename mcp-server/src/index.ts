#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  getDb,
  listDiagrams as dbListDiagrams,
  getDiagramById as dbGetDiagram,
  upsertDiagram as dbSaveDiagram,
  deleteDiagram as dbDeleteDiagram,
  listProjects as dbListProjects,
  listProjectsMeta as dbListProjectsMeta,
  getProjectById as dbGetProject,
  upsertProject as dbSaveProject,
  deleteProject as dbDeleteProject,
} from "./db.js";
import type { Diagram, KanbanProject, KanbanEpic, KanbanTask, KanbanColumn, KanbanTaskLink, ProjectSession } from "./types.js";
import { DEFAULT_KANBAN_COLUMNS } from "./types.js";

// Ensure DB is initialized
getDb();
const MERMAID_NODE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const server = new McpServer({
  name: "planview",
  version: "1.1.0",
});

function escapeMermaidQuotedText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/"/g, '\\"');
}

function sanitizeMermaidEdgeLabel(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "/").trim();
}

function escapeErQuotedText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '\\"');
}

function sanitizeErToken(value: string, fallback: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_[\](),.-]/g, "");
  return cleaned || fallback;
}

function markDiagramFlowStale(diagram: Diagram): void {
  diagram.nodes = [];
  diagram.edges = [];
}

// ─── Tool: list_diagrams ─────────────────────────────────────────────
server.registerTool("list_diagrams", {
  title: "List Diagrams",
  description: "List all saved diagrams",
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async () => {
  const diagrams = dbListDiagrams();
  const summary = diagrams.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    updatedAt: d.updatedAt,
  }));
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(summary, null, 2),
      },
    ],
  };
});

// ─── Tool: get_diagram ───────────────────────────────────────────────
server.registerTool("get_diagram", {
  title: "Get Diagram",
  description: "Get a diagram by ID, returns full mermaid code and metadata",
  inputSchema: { id: z.string().describe("The diagram ID") },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ id }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(diagram, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: create_diagram ────────────────────────────────────────────
server.registerTool("create_diagram", {
  title: "Create Diagram",
  description: "Create a new architecture diagram from mermaid code",
  inputSchema: {
    name: z.string().describe("Name of the diagram"),
    description: z.string().optional().describe("Description of the diagram"),
    mermaidCode: z
      .string()
      .describe("Mermaid code defining the diagram (graph TD format)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ name, description, mermaidCode }) => {
    const now = new Date().toISOString();
    const diagram: Diagram = {
      id: uuidv4(),
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
      mermaidCode,
      nodes: [],
      edges: [],
    };
    dbSaveDiagram(diagram);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: diagram.id, name: diagram.name, message: "Diagram created" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: update_diagram ────────────────────────────────────────────
server.registerTool("update_diagram", {
  title: "Update Diagram",
  description: "Update an existing diagram's mermaid code, name, or description",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    mermaidCode: z.string().optional().describe("New mermaid code"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ id, name, description, mermaidCode }) => {
    const existing = dbGetDiagram(id);
    if (!existing) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }

    const nextMermaidCode = mermaidCode ?? existing.mermaidCode;
    const mermaidChanged = mermaidCode !== undefined && mermaidCode !== existing.mermaidCode;
    const updated: Diagram = {
      ...existing,
      name: name ?? existing.name,
      description: description ?? existing.description,
      mermaidCode: nextMermaidCode,
      updatedAt: new Date().toISOString(),
    };
    if (mermaidChanged) {
      markDiagramFlowStale(updated);
    }
    dbSaveDiagram(updated);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: updated.id, name: updated.name, message: "Diagram updated" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: delete_diagram ────────────────────────────────────────────
server.registerTool("delete_diagram", {
  title: "Delete Diagram",
  description: "Delete a diagram by ID",
  inputSchema: { id: z.string().describe("The diagram ID") },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ id }) => {
    const deleted = dbDeleteDiagram(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted
            ? `Diagram ${id} deleted`
            : `Diagram not found: ${id}`,
        },
      ],
      isError: !deleted,
    };
  }
);

// ─── Tool: add_node ──────────────────────────────────────────────────
server.registerTool("add_node_to_diagram", {
  title: "Add Node to Diagram",
  description: "Add a new node (component) to a diagram's mermaid code",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
    nodeId: z
      .string()
      .regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID")
      .describe("Unique node identifier (e.g. 'api_gateway')"),
    label: z.string().describe("Display label for the node"),
    shapeType: z
      .enum([
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
      ])
      .describe("The shape type for the node"),
    description: z.string().optional().describe("Optional description"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ id, nodeId, label, shapeType, description }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }

    const fullLabel = description ? `${label} - ${description}` : label;
    const safeLabel = escapeMermaidQuotedText(fullLabel);
    const shapeMap: Record<string, (id: string, l: string) => string> = {
      service: (i, l) => `${i}["${l}"]`,
      database: (i, l) => `${i}[("${l}")]`,
      gateway: (i, l) => `${i}(["${l}"])`,
      queue: (i, l) => `${i}{{"${l}"}}`,
      client: (i, l) => `${i}(["${l}"])`,
      cloud: (i, l) => `${i}["${l}"]`,
      cache: (i, l) => `${i}{"${l}"}`,
      storage: (i, l) => `${i}[("${l}")]`,
      function: (i, l) => `${i}[/"${l}"\\]`,
      container: (i, l) => `${i}["${l}"]`,
      custom: (i, l) => `${i}["${l}"]`,
    };

    const formatter = shapeMap[shapeType] ?? shapeMap.service;
    const nodeLine = `    ${formatter(nodeId, safeLabel)}`;

    const lines = diagram.mermaidCode.split("\n");
    // Insert after the last node definition (before edges/style lines)
    let insertIdx = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      if (
        trimmed.startsWith("style ") ||
        trimmed.includes("-->") ||
        trimmed === ""
      ) {
        insertIdx = i;
      } else {
        break;
      }
    }
    lines.splice(insertIdx, 0, nodeLine);

    diagram.mermaidCode = lines.join("\n");
    markDiagramFlowStale(diagram);
    diagram.updatedAt = new Date().toISOString();
    dbSaveDiagram(diagram);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { message: `Node '${nodeId}' added`, mermaidCode: diagram.mermaidCode },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: add_edge ──────────────────────────────────────────────────
server.registerTool("add_edge_to_diagram", {
  title: "Add Edge to Diagram",
  description: "Add a connection (edge) between two nodes in a diagram",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
    source: z
      .string()
      .regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID")
      .describe("Source node ID"),
    target: z
      .string()
      .regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID")
      .describe("Target node ID"),
    label: z.string().optional().describe("Optional edge label (e.g. 'HTTP', 'gRPC')"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ id, source, target, label }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }

    const safeEdgeLabel = label ? sanitizeMermaidEdgeLabel(label) : "";
    const edgeLine = safeEdgeLabel
      ? `    ${source} -->|${safeEdgeLabel}| ${target}`
      : `    ${source} --> ${target}`;

    const lines = diagram.mermaidCode.split("\n");
    // Insert before style lines
    let insertIdx = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith("style ")) {
        insertIdx = i;
      } else {
        break;
      }
    }
    lines.splice(insertIdx, 0, edgeLine);

    diagram.mermaidCode = lines.join("\n");
    markDiagramFlowStale(diagram);
    diagram.updatedAt = new Date().toISOString();
    dbSaveDiagram(diagram);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              message: `Edge ${source} -> ${target} added`,
              mermaidCode: diagram.mermaidCode,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: create_database_schema ────────────────────────────────────────
server.registerTool("create_database_schema", {
  title: "Create Database Schema",
  description: "Create a new diagram with database schema (ER diagram) using erDiagram mermaid syntax. Defines tables with columns and relationships between them.",
  inputSchema: {
    name: z.string().describe("Name of the diagram"),
    description: z.string().optional().describe("Description of the diagram"),
    tables: z
      .array(
        z.object({
          name: z.string().describe("Table name (e.g. 'users', 'orders')"),
          columns: z.array(
            z.object({
              name: z.string().describe("Column name"),
              type: z.string().describe("Column type (e.g. 'int', 'varchar', 'timestamp')"),
              constraint: z
                .enum(["primary", "foreign", "unique", "nullable"])
                .optional()
                .describe("Column constraint"),
            })
          ),
        })
      )
      .describe("Array of table definitions"),
    relationships: z
      .array(
        z.object({
          from: z.string().describe("Source table name"),
          to: z.string().describe("Target table name"),
          label: z.string().describe("Relationship label (e.g. 'has many', 'belongs to')"),
          cardinality: z
            .enum(["one-to-one", "one-to-many", "many-to-many"])
            .optional()
            .default("one-to-many")
            .describe("Relationship cardinality"),
        })
      )
      .optional()
      .describe("Relationships between tables"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ name, description, tables, relationships }) => {
    const now = new Date().toISOString();

    // Build erDiagram mermaid code
    const lines: string[] = ["erDiagram"];

    for (const table of tables) {
      const safeName = table.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "table";
      lines.push(`    ${safeName} {`);
      for (const col of table.columns) {
        const safeType = sanitizeErToken(col.type, "string");
        const safeColumnName = sanitizeErToken(col.name, "column");
        const constraintStr = col.constraint
          ? ` ${col.constraint.toUpperCase()}`
          : "";
        lines.push(`        ${safeType} ${safeColumnName}${constraintStr}`);
      }
      lines.push("    }");
    }

    if (relationships) {
      const cardinalityMap: Record<string, string> = {
        "one-to-one": "||--||",
        "one-to-many": "||--o{",
        "many-to-many": "}o--o{",
      };
      for (const rel of relationships) {
        const from = rel.from.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "from_table";
        const to = rel.to.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "to_table";
        const card = cardinalityMap[rel.cardinality ?? "one-to-many"] ?? "||--o{";
        lines.push(`    ${from} ${card} ${to} : "${escapeErQuotedText(rel.label)}"`);
      }
    }

    const mermaidCode = lines.join("\n") + "\n";

    const diagram: Diagram = {
      id: uuidv4(),
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
      mermaidCode,
      nodes: [],
      edges: [],
    };
    dbSaveDiagram(diagram);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              id: diagram.id,
              name: diagram.name,
              message: "Database schema diagram created",
              mermaidCode,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: add_table_to_diagram ──────────────────────────────────────────
server.registerTool("add_table_to_diagram", {
  title: "Add Table to Diagram",
  description: "Add a database table (with columns) to an existing diagram's erDiagram mermaid code",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
    tableName: z.string().describe("Name of the table"),
    columns: z.array(
      z.object({
        name: z.string().describe("Column name"),
        type: z.string().describe("Column type (e.g. 'int', 'varchar', 'timestamp')"),
        constraint: z
          .enum(["primary", "foreign", "unique", "nullable"])
          .optional()
          .describe("Column constraint"),
      })
    ),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ id, tableName, columns }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }

    const safeName = tableName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "table";

    const tableLines: string[] = [];
    tableLines.push(`    ${safeName} {`);
    for (const col of columns) {
      const safeType = sanitizeErToken(col.type, "string");
      const safeColumnName = sanitizeErToken(col.name, "column");
      const constraintStr = col.constraint
        ? ` ${col.constraint.toUpperCase()}`
        : "";
      tableLines.push(`        ${safeType} ${safeColumnName}${constraintStr}`);
    }
    tableLines.push("    }");

    // Ensure erDiagram section exists
    let code = diagram.mermaidCode;
    if (!code.includes("erDiagram")) {
      code = code.trimEnd() + "\n\nerDiagram\n";
    }

    const lines = code.split("\n");
    // Find the end of erDiagram section to insert before relationships
    let insertIdx = lines.length;
    const erIdx = lines.findIndex((l) => l.trim() === "erDiagram");
    if (erIdx !== -1) {
      // Insert after last table definition (before relationships)
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
      if (insertIdx === lines.length) {
        insertIdx = lines.length;
      }
    }

    lines.splice(insertIdx, 0, ...tableLines);
    diagram.mermaidCode = lines.join("\n");
    markDiagramFlowStale(diagram);
    diagram.updatedAt = new Date().toISOString();
    dbSaveDiagram(diagram);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              message: `Table '${tableName}' added`,
              mermaidCode: diagram.mermaidCode,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: add_relationship_to_diagram ─────────────────────────────────────
server.registerTool("add_relationship_to_diagram", {
  title: "Add Relationship to Diagram",
  description: "Add a relationship between two tables in an existing diagram's erDiagram",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
    from: z.string().describe("Source table name"),
    to: z.string().describe("Target table name"),
    label: z.string().describe("Relationship label (e.g. 'has many', 'belongs to')"),
    cardinality: z
      .enum(["one-to-one", "one-to-many", "many-to-many"])
      .optional()
      .default("one-to-many")
      .describe("Relationship cardinality"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ id, from, to, label, cardinality }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${id}` }],
        isError: true,
      };
    }

    const cardinalityMap: Record<string, string> = {
      "one-to-one": "||--||",
      "one-to-many": "||--o{",
      "many-to-many": "}o--o{",
    };
    const safeFrom = from.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "from_table";
    const safeTo = to.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") || "to_table";
    const card = cardinalityMap[cardinality ?? "one-to-many"] ?? "||--o{";
    const relLine = `    ${safeFrom} ${card} ${safeTo} : "${escapeErQuotedText(label)}"`;

    // Ensure erDiagram section exists
    let code = diagram.mermaidCode;
    if (!code.includes("erDiagram")) {
      code = code.trimEnd() + "\n\nerDiagram\n";
    }

    const lines = code.split("\n");
    // Find the end of erDiagram section to insert before styles
    let insertIdx = lines.length;
    const erIdx = lines.findIndex((l) => l.trim() === "erDiagram");
    if (erIdx !== -1) {
      for (let i = lines.length - 1; i >= erIdx; i--) {
        if (lines[i].trim().startsWith("style ")) {
          insertIdx = i;
        } else if (lines[i].trim().length > 0 && i > erIdx) {
          // Insert after the last non-empty line in the erDiagram block, before styles
          insertIdx = i + 1;
          break;
        }
      }
    }

    lines.splice(insertIdx, 0, relLine);
    diagram.mermaidCode = lines.join("\n");
    markDiagramFlowStale(diagram);
    diagram.updatedAt = new Date().toISOString();
    dbSaveDiagram(diagram);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              message: `Relationship ${from} -> ${to} added`,
              mermaidCode: diagram.mermaidCode,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// PROJECT TOOLS (Unified Task Management)
// ═══════════════════════════════════════════════════════════════════════

// ─── Tool: list_projects ─────────────────────────────────────────────
server.registerTool("list_projects", {
  title: "List Projects",
  description: "List all projects (summary)",
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async () => {
  const projects = dbListProjects();
  const summary = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    epicCount: p.epics.length,
    taskCount: p.tasks.length,
    columnCount: p.columns.length,
    sessionCount: p.sessions.length,
    diagramCount: p.diagramIds.length,
    updatedAt: p.updatedAt,
  }));
  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
});

// ─── Tool: get_project ───────────────────────────────────────────────
server.registerTool("get_project", {
  title: "Get Project",
  description: "Get a project by ID with all columns, epics, tasks, sessions, and diagram links",
  inputSchema: { id: z.string().describe("The project ID") },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ id }) => {
    const project = dbGetProject(id);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(project, null, 2) }],
    };
  }
);

// ─── Tool: create_project ────────────────────────────────────────────
server.registerTool("create_project", {
  title: "Create Project",
  description: "Create a new project with optional custom columns (defaults to Backlog/To Do/In Progress/Review/Done)",
  inputSchema: {
    name: z.string().describe("Project name"),
    description: z.string().optional().describe("Project description"),
    columns: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          color: z.string(),
          position: z.number(),
          wipLimit: z.number().optional(),
        })
      )
      .optional()
      .describe("Custom columns (defaults to 5 standard columns)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ name, description, columns }) => {
    const now = new Date().toISOString();
    const project: KanbanProject = {
      id: uuidv4(),
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
      columns: columns ?? [...DEFAULT_KANBAN_COLUMNS],
      epics: [],
      tasks: [],
      sessions: [],
      diagramIds: [],
    };
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: project.id, name: project.name, columnCount: project.columns.length, message: "Project created" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: update_project ────────────────────────────────────────────
server.registerTool("update_project", {
  title: "Update Project",
  description: "Update project metadata (name, description)",
  inputSchema: {
    id: z.string().describe("The project ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ id, name, description }) => {
    const project = dbGetProject(id);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${id}` }],
        isError: true,
      };
    }
    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ id: project.id, name: project.name, message: "Project updated" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_project ────────────────────────────────────────────
server.registerTool("delete_project", {
  title: "Delete Project",
  description: "Delete a project and all its data",
  inputSchema: { id: z.string().describe("The project ID") },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ id }) => {
    const deleted = dbDeleteProject(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted ? `Project ${id} deleted` : `Project not found: ${id}`,
        },
      ],
      isError: !deleted,
    };
  }
);

// ─── Tool: add_kanban_column ─────────────────────────────────────────
server.registerTool("add_kanban_column", {
  title: "Add Kanban Column",
  description: "Add a column to a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    name: z.string().describe("Column name"),
    color: z.string().describe("Column color (hex)"),
    position: z.number().optional().describe("Position (appends to end if omitted)"),
    wipLimit: z.number().optional().describe("Work-in-progress limit"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, name, color, position, wipLimit }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const column: KanbanColumn = {
      id: uuidv4(),
      name,
      color,
      position: position ?? project.columns.length,
      wipLimit,
    };
    project.columns.push(column);
    project.columns.sort((a, b) => a.position - b.position);
    project.columns.forEach((c, i) => { c.position = i; });
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ columnId: column.id, name: column.name, message: "Column added" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: update_kanban_column ──────────────────────────────────────
server.registerTool("update_kanban_column", {
  title: "Update Kanban Column",
  description: "Update a column (name, color, wipLimit)",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    columnId: z.string().describe("The column ID"),
    name: z.string().optional().describe("New name"),
    color: z.string().optional().describe("New color (hex)"),
    wipLimit: z.number().optional().describe("New WIP limit"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, columnId, name, color, wipLimit }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const column = project.columns.find((c) => c.id === columnId);
    if (!column) {
      return {
        content: [{ type: "text" as const, text: `Column not found: ${columnId}` }],
        isError: true,
      };
    }
    if (name !== undefined) column.name = name;
    if (color !== undefined) column.color = color;
    if (wipLimit !== undefined) column.wipLimit = wipLimit;
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ columnId: column.id, name: column.name, message: "Column updated" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: reorder_kanban_columns ────────────────────────────────────
server.registerTool("reorder_kanban_columns", {
  title: "Reorder Kanban Columns",
  description: "Reorder all columns in a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    columnIds: z.array(z.string()).describe("Ordered column IDs"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, columnIds }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const columnMap = new Map(project.columns.map((c) => [c.id, c]));
    const reordered: KanbanColumn[] = [];
    for (let i = 0; i < columnIds.length; i++) {
      const col = columnMap.get(columnIds[i]);
      if (!col) {
        return {
          content: [{ type: "text" as const, text: `Column not found: ${columnIds[i]}` }],
          isError: true,
        };
      }
      col.position = i;
      reordered.push(col);
    }
    project.columns = reordered;
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Columns reordered", order: columnIds }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_kanban_column ──────────────────────────────────────
server.registerTool("delete_kanban_column", {
  title: "Delete Kanban Column",
  description: "Delete a column and move orphaned tasks to a target column",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    columnId: z.string().describe("The column to delete"),
    targetColumnId: z.string().describe("Column to move orphaned tasks to"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ projectId, columnId, targetColumnId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    if (!project.columns.some((c) => c.id === targetColumnId)) {
      return {
        content: [{ type: "text" as const, text: `Target column not found: ${targetColumnId}` }],
        isError: true,
      };
    }
    if (columnId === targetColumnId) {
      return {
        content: [{ type: "text" as const, text: "Cannot delete column into itself" }],
        isError: true,
      };
    }
    for (const task of project.tasks) {
      if (task.columnId === columnId) {
        task.columnId = targetColumnId;
      }
    }
    project.columns = project.columns.filter((c) => c.id !== columnId);
    project.columns.sort((a, b) => a.position - b.position);
    project.columns.forEach((c, i) => { c.position = i; });
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Column ${columnId} deleted, tasks moved to ${targetColumnId}` }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: list_kanban_epics ─────────────────────────────────────────
server.registerTool("list_kanban_epics", {
  title: "List Kanban Epics",
  description: "List all epics in a project",
  inputSchema: { projectId: z.string().describe("The project ID") },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ projectId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(project.epics, null, 2) }],
    };
  }
);

// ─── Tool: get_kanban_epic ───────────────────────────────────────────
server.registerTool("get_kanban_epic", {
  title: "Get Kanban Epic",
  description: "Get an epic and its tasks",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    epicId: z.string().describe("The epic ID"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ projectId, epicId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const epic = project.epics.find((e) => e.id === epicId);
    if (!epic) {
      return {
        content: [{ type: "text" as const, text: `Epic not found: ${epicId}` }],
        isError: true,
      };
    }
    const tasks = project.tasks.filter((t) => t.epicId === epicId);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ ...epic, tasks }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: create_kanban_epic ────────────────────────────────────────
server.registerTool("create_kanban_epic", {
  title: "Create Kanban Epic",
  description: "Create an epic in a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    name: z.string().describe("Epic name"),
    description: z.string().optional().describe("Epic description"),
    color: z.string().optional().describe("Badge color (hex)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, name, description, color }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const now = new Date().toISOString();
    const epic: KanbanEpic = {
      id: uuidv4(),
      name,
      description,
      color,
      createdAt: now,
      updatedAt: now,
    };
    project.epics.push(epic);
    project.updatedAt = now;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ epicId: epic.id, name: epic.name, message: "Epic created" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: update_kanban_epic ────────────────────────────────────────
server.registerTool("update_kanban_epic", {
  title: "Update Kanban Epic",
  description: "Update an epic in a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    epicId: z.string().describe("The epic ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    color: z.string().optional().describe("New badge color"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, epicId, name, description, color }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const epic = project.epics.find((e) => e.id === epicId);
    if (!epic) {
      return {
        content: [{ type: "text" as const, text: `Epic not found: ${epicId}` }],
        isError: true,
      };
    }
    if (name !== undefined) epic.name = name;
    if (description !== undefined) epic.description = description;
    if (color !== undefined) epic.color = color;
    epic.updatedAt = new Date().toISOString();
    project.updatedAt = epic.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ epicId: epic.id, name: epic.name, message: "Epic updated" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_kanban_epic ────────────────────────────────────────
server.registerTool("delete_kanban_epic", {
  title: "Delete Kanban Epic",
  description: "Delete an epic. Optionally move its tasks to another epic, otherwise tasks are deleted.",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    epicId: z.string().describe("The epic to delete"),
    targetEpicId: z.string().optional().describe("Epic to move tasks to (tasks deleted if omitted)"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ projectId, epicId, targetEpicId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    if (!project.epics.some((e) => e.id === epicId)) {
      return {
        content: [{ type: "text" as const, text: `Epic not found: ${epicId}` }],
        isError: true,
      };
    }
    if (targetEpicId) {
      if (!project.epics.some((e) => e.id === targetEpicId)) {
        return {
          content: [{ type: "text" as const, text: `Target epic not found: ${targetEpicId}` }],
          isError: true,
        };
      }
      for (const task of project.tasks) {
        if (task.epicId === epicId) task.epicId = targetEpicId;
      }
    } else {
      project.tasks = project.tasks.filter((t) => t.epicId !== epicId);
    }
    project.epics = project.epics.filter((e) => e.id !== epicId);
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Epic ${epicId} deleted${targetEpicId ? ", tasks moved" : ", tasks removed"}` }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: create_kanban_task ────────────────────────────────────────
server.registerTool("create_kanban_task", {
  title: "Create Kanban Task",
  description: "Create a task in a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    epicId: z.string().describe("The epic ID this task belongs to"),
    columnId: z.string().describe("The column ID for Kanban placement"),
    name: z.string().describe("Task name"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
    assignee: z.string().optional(),
    tags: z.array(z.string()).optional().default([]),
    startDate: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    dueDate: z.string().optional().describe("Due date (YYYY-MM-DD)"),
    progress: z.number().min(0).max(100).optional().default(0),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          type: z.enum(["jira", "github-pr", "github-issue", "confluence", "slack", "other"]),
        })
      )
      .optional()
      .default([]),
    metadata: z.record(z.string()).optional().default({}),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, epicId, columnId, name, description, priority, assignee, tags, startDate, dueDate, progress, links, metadata }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    if (!project.epics.some((e) => e.id === epicId)) {
      return {
        content: [{ type: "text" as const, text: `Epic not found: ${epicId}` }],
        isError: true,
      };
    }
    if (!project.columns.some((c) => c.id === columnId)) {
      return {
        content: [{ type: "text" as const, text: `Column not found: ${columnId}` }],
        isError: true,
      };
    }
    const now = new Date().toISOString();
    const tasksInColumn = project.tasks.filter((t) => t.columnId === columnId);
    const task: KanbanTask = {
      id: uuidv4(),
      epicId,
      columnId,
      name,
      description,
      priority,
      assignee,
      tags,
      startDate,
      dueDate,
      progress,
      position: tasksInColumn.length,
      links,
      metadata,
      createdAt: now,
      updatedAt: now,
    };
    project.tasks.push(task);
    project.updatedAt = now;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ taskId: task.id, name: task.name, message: "Task created" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: update_kanban_task ────────────────────────────────────────
server.registerTool("update_kanban_task", {
  title: "Update Kanban Task",
  description: "Update any fields of a task",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    taskId: z.string().describe("The task ID"),
    name: z.string().optional(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    assignee: z.string().optional(),
    tags: z.array(z.string()).optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    progress: z.number().min(0).max(100).optional(),
    metadata: z.record(z.string()).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, taskId, ...updates }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    if (updates.name !== undefined) task.name = updates.name;
    if (updates.description !== undefined) task.description = updates.description;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.assignee !== undefined) task.assignee = updates.assignee;
    if (updates.tags !== undefined) task.tags = updates.tags;
    if (updates.startDate !== undefined) task.startDate = updates.startDate;
    if (updates.dueDate !== undefined) task.dueDate = updates.dueDate;
    if (updates.progress !== undefined) task.progress = updates.progress;
    if (updates.metadata !== undefined) task.metadata = updates.metadata;
    task.updatedAt = new Date().toISOString();
    project.updatedAt = task.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ task, message: "Task updated" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: move_kanban_task ──────────────────────────────────────────
server.registerTool("move_kanban_task", {
  title: "Move Kanban Task",
  description: "Move a task to a different column and/or position (drag-and-drop)",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    taskId: z.string().describe("The task ID"),
    columnId: z.string().optional().describe("Target column ID"),
    position: z.number().optional().describe("Target position within column"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, taskId, columnId, position }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    const targetCol = columnId ?? task.columnId;
    if (!project.columns.some((c) => c.id === targetCol)) {
      return {
        content: [{ type: "text" as const, text: `Column not found: ${targetCol}` }],
        isError: true,
      };
    }
    task.columnId = targetCol;
    const colTasks = project.tasks
      .filter((t) => t.columnId === targetCol && t.id !== taskId)
      .sort((a, b) => a.position - b.position);
    const insertAt = position !== undefined ? Math.min(position, colTasks.length) : colTasks.length;
    colTasks.splice(insertAt, 0, task);
    colTasks.forEach((t, i) => { t.position = i; });
    task.updatedAt = new Date().toISOString();
    project.updatedAt = task.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ taskId: task.id, columnId: task.columnId, position: task.position, message: "Task moved" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_kanban_task ────────────────────────────────────────
server.registerTool("delete_kanban_task", {
  title: "Delete Kanban Task",
  description: "Delete a task from a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    taskId: z.string().describe("The task ID"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ projectId, taskId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const before = project.tasks.length;
    project.tasks = project.tasks.filter((t) => t.id !== taskId);
    if (project.tasks.length === before) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    // Also remove task from any sessions
    for (const session of project.sessions) {
      session.taskIds = session.taskIds.filter((tid) => tid !== taskId);
    }
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task ${taskId} deleted` }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: list_kanban_tasks ─────────────────────────────────────────
server.registerTool("list_kanban_tasks", {
  title: "List Kanban Tasks",
  description: "List and filter tasks in a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    epicId: z.string().optional().describe("Filter by epic"),
    columnId: z.string().optional().describe("Filter by column"),
    assignee: z.string().optional().describe("Filter by assignee"),
    priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Filter by priority"),
    tag: z.string().optional().describe("Filter by tag"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ projectId, epicId, columnId, assignee, priority, tag }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    let tasks = project.tasks;
    if (epicId) tasks = tasks.filter((t) => t.epicId === epicId);
    if (columnId) tasks = tasks.filter((t) => t.columnId === columnId);
    if (assignee) tasks = tasks.filter((t) => t.assignee === assignee);
    if (priority) tasks = tasks.filter((t) => t.priority === priority);
    if (tag) tasks = tasks.filter((t) => t.tags.includes(tag));
    return {
      content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }],
    };
  }
);

// ─── Tool: add_link_to_kanban_task ───────────────────────────────────
server.registerTool("add_link_to_kanban_task", {
  title: "Add Link to Task",
  description: "Add a typed link to a task",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    taskId: z.string().describe("The task ID"),
    label: z.string().describe("Link label"),
    url: z.string().url().describe("Link URL"),
    type: z.enum(["jira", "github-pr", "github-issue", "confluence", "slack", "other"]).describe("Link type"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, taskId, label, url, type }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const task = project.tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    task.links.push({ label, url, type });
    task.updatedAt = new Date().toISOString();
    project.updatedAt = task.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Link added to task ${taskId}`, linkCount: task.links.length }, null, 2),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// PROJECT SESSION TOOLS
// ═══════════════════════════════════════════════════════════════════════

// ─── Tool: add_project_session ───────────────────────────────────────
server.registerTool("add_project_session", {
  title: "Add Project Session",
  description: "Create a new focus session within a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    title: z.string().describe("Session title"),
    notes: z.string().optional().describe("Session notes"),
    taskIds: z.array(z.string()).optional().describe("Task IDs to link to this session"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, title, notes, taskIds }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const now = new Date().toISOString();
    const session: ProjectSession = {
      id: uuidv4(),
      title,
      notes: notes ?? "",
      taskIds: taskIds ?? [],
      pomodorosCompleted: 0,
      createdAt: now,
      updatedAt: now,
    };
    project.sessions.push(session);
    project.updatedAt = now;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ sessionId: session.id, title: session.title, message: "Session created" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: update_project_session ────────────────────────────────────
server.registerTool("update_project_session", {
  title: "Update Project Session",
  description: "Update a session's title or notes",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    sessionId: z.string().describe("The session ID"),
    title: z.string().optional().describe("New title"),
    notes: z.string().optional().describe("New notes"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ projectId, sessionId, title, notes }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const session = project.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${sessionId}` }],
        isError: true,
      };
    }
    if (title !== undefined) session.title = title;
    if (notes !== undefined) session.notes = notes;
    session.updatedAt = new Date().toISOString();
    project.updatedAt = session.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ sessionId: session.id, title: session.title, message: "Session updated" }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: remove_project_session ────────────────────────────────────
server.registerTool("remove_project_session", {
  title: "Remove Project Session",
  description: "Remove a session from a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    sessionId: z.string().describe("The session ID"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ projectId, sessionId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const before = project.sessions.length;
    project.sessions = project.sessions.filter((s) => s.id !== sessionId);
    if (project.sessions.length === before) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${sessionId}` }],
        isError: true,
      };
    }
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Session ${sessionId} removed`, sessionCount: project.sessions.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: add_task_to_project_session ───────────────────────────────
server.registerTool("add_task_to_project_session", {
  title: "Add Task to Session",
  description: "Link a task to a project session",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    sessionId: z.string().describe("The session ID"),
    taskId: z.string().describe("The task ID to link"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, sessionId, taskId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const session = project.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${sessionId}` }],
        isError: true,
      };
    }
    if (!project.tasks.some((t) => t.id === taskId)) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
      session.updatedAt = new Date().toISOString();
      project.updatedAt = session.updatedAt;
      dbSaveProject(project);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task ${taskId} linked to session`, taskCount: session.taskIds.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: remove_task_from_project_session ──────────────────────────
server.registerTool("remove_task_from_project_session", {
  title: "Remove Task from Session",
  description: "Unlink a task from a project session",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    sessionId: z.string().describe("The session ID"),
    taskId: z.string().describe("The task ID to unlink"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, sessionId, taskId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    const session = project.sessions.find((s) => s.id === sessionId);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${sessionId}` }],
        isError: true,
      };
    }
    session.taskIds = session.taskIds.filter((tid) => tid !== taskId);
    session.updatedAt = new Date().toISOString();
    project.updatedAt = session.updatedAt;
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task ${taskId} unlinked from session`, taskCount: session.taskIds.length }, null, 2),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// DIAGRAM LINKING TOOLS
// ═══════════════════════════════════════════════════════════════════════

// ─── Tool: link_diagram_to_project ───────────────────────────────────
server.registerTool("link_diagram_to_project", {
  title: "Link Diagram to Project",
  description: "Link a diagram to a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    diagramId: z.string().describe("The diagram ID to link"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, diagramId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    // Verify diagram exists
    const diagram = dbGetDiagram(diagramId);
    if (!diagram) {
      return {
        content: [{ type: "text" as const, text: `Diagram not found: ${diagramId}` }],
        isError: true,
      };
    }
    if (!project.diagramIds.includes(diagramId)) {
      project.diagramIds.push(diagramId);
      project.updatedAt = new Date().toISOString();
      dbSaveProject(project);
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Diagram ${diagramId} linked to project`, diagramCount: project.diagramIds.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: unlink_diagram_from_project ───────────────────────────────
server.registerTool("unlink_diagram_from_project", {
  title: "Unlink Diagram from Project",
  description: "Unlink a diagram from a project",
  inputSchema: {
    projectId: z.string().describe("The project ID"),
    diagramId: z.string().describe("The diagram ID to unlink"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ projectId, diagramId }) => {
    const project = dbGetProject(projectId);
    if (!project) {
      return {
        content: [{ type: "text" as const, text: `Project not found: ${projectId}` }],
        isError: true,
      };
    }
    project.diagramIds = project.diagramIds.filter((id) => id !== diagramId);
    project.updatedAt = new Date().toISOString();
    dbSaveProject(project);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Diagram ${diagramId} unlinked from project`, diagramCount: project.diagramIds.length }, null, 2),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// RESOURCES
// ═══════════════════════════════════════════════════════════════════════

// ─── Resource: all diagrams ──────────────────────────────────────────
server.registerResource("diagrams", "planview://diagrams", {
  title: "All Diagrams",
  description: "List of all diagrams in the workspace",
  mimeType: "application/json",
}, async (uri) => {
  const diagrams = dbListDiagrams();
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          diagrams.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
          })),
          null,
          2
        ),
      },
    ],
  };
});

// ─── Resource: all projects ──────────────────────────────────────────
server.registerResource("projects", "planview://projects", {
  title: "All Projects",
  description: "List of all projects in the workspace",
  mimeType: "application/json",
}, async (uri) => {
  const projects = dbListProjectsMeta();
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(projects, null, 2),
      },
    ],
  };
});

// ─── Resource: single project (dynamic) ──────────────────────────────
server.registerResource(
  "project",
  new ResourceTemplate("planview://projects/{projectId}", {
    list: async () => ({
      resources: dbListProjectsMeta().map((p) => ({
        uri: `planview://projects/${p.id}`,
        name: p.name,
      })),
    }),
  }),
  {
    title: "Project Details",
    description: "Full project with tasks, columns, epics, and sessions",
    mimeType: "application/json",
  },
  async (uri, { projectId }) => {
    const project = dbGetProject(projectId as string);
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: project
            ? JSON.stringify(project, null, 2)
            : JSON.stringify({ error: "Project not found" }),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════════

server.registerPrompt("plan-sprint", {
  title: "Plan Sprint",
  description: "Generate a sprint plan from backlog tasks",
  argsSchema: {
    projectId: z.string().describe("Project to plan"),
    sprintGoal: z.string().optional().describe("Sprint goal or theme"),
  },
}, ({ projectId, sprintGoal }) => {
  const project = dbGetProject(projectId);
  if (!project) {
    return {
      messages: [{
        role: "user" as const,
        content: { type: "text" as const, text: "Project not found" },
      }],
    };
  }
  const backlog = project.tasks.filter((t) => t.columnId === project.columns[0]?.id);
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Plan a sprint for "${project.name}"${sprintGoal ? ` with goal: ${sprintGoal}` : ""}.

Backlog tasks (${backlog.length}):
${backlog.map((t) => `- [${t.priority}] ${t.name}${t.dueDate ? ` (due: ${t.dueDate})` : ""}`).join("\n") || "(empty)"}

Suggest which tasks to move to "To Do" and estimate a timeline.`,
      },
    }],
  };
});

server.registerPrompt("project-status", {
  title: "Project Status Report",
  description: "Generate a status report for a project",
  argsSchema: {
    projectId: z.string().describe("Project to report on"),
  },
}, ({ projectId }) => {
  const project = dbGetProject(projectId);
  if (!project) {
    return {
      messages: [{
        role: "user" as const,
        content: { type: "text" as const, text: "Project not found" },
      }],
    };
  }
  const tasksByColumn = project.columns.map((col) => {
    const tasks = project.tasks.filter((t) => t.columnId === col.id);
    return `${col.name}: ${tasks.length} tasks`;
  });
  return {
    messages: [{
      role: "user" as const,
      content: {
        type: "text" as const,
        text: `Generate a concise status report for project "${project.name}".

Column breakdown:
${tasksByColumn.join("\n")}

Total tasks: ${project.tasks.length}
Epics: ${project.epics.length}
Sessions: ${project.sessions.length}

Highlight blockers, progress, and next steps.`,
      },
    }],
  };
});

// ─── Start the server ────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("PlanView MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
