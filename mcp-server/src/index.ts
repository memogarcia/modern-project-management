#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { DiagramStorage, GanttStorage, SessionStorage, MatrixStorage } from "./storage.js";
import type { Diagram, GanttChart, GanttTask, Session, MatrixBoard, MatrixTask } from "./types.js";

const storage = new DiagramStorage(process.env.DIAGRAMS_DIR);
const ganttStorage = new GanttStorage(storage.baseDir);
const sessionStorage = new SessionStorage(storage.baseDir);
const matrixStorage = new MatrixStorage(storage.baseDir);
const MERMAID_NODE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const server = new McpServer({
  name: "archdiagram",
  version: "1.0.0",
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
server.tool("list_diagrams", "List all saved diagrams", {}, async () => {
  const diagrams = storage.list();
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
server.tool(
  "get_diagram",
  "Get a diagram by ID, returns full mermaid code and metadata",
  { id: z.string().describe("The diagram ID") },
  async ({ id }) => {
    const diagram = storage.get(id);
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
server.tool(
  "create_diagram",
  "Create a new architecture diagram from mermaid code",
  {
    name: z.string().describe("Name of the diagram"),
    description: z.string().optional().describe("Description of the diagram"),
    mermaidCode: z
      .string()
      .describe("Mermaid code defining the diagram (graph TD format)"),
  },
  async ({ name, description, mermaidCode }) => {
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
    storage.save(diagram);
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
server.tool(
  "update_diagram",
  "Update an existing diagram's mermaid code, name, or description",
  {
    id: z.string().describe("The diagram ID"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    mermaidCode: z.string().optional().describe("New mermaid code"),
  },
  async ({ id, name, description, mermaidCode }) => {
    const existing = storage.get(id);
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
    storage.save(updated);
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
server.tool(
  "delete_diagram",
  "Delete a diagram by ID",
  { id: z.string().describe("The diagram ID") },
  async ({ id }) => {
    const deleted = storage.delete(id);
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
server.tool(
  "add_node_to_diagram",
  "Add a new node (component) to a diagram's mermaid code",
  {
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
  async ({ id, nodeId, label, shapeType, description }) => {
    const diagram = storage.get(id);
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
    storage.save(diagram);

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
server.tool(
  "add_edge_to_diagram",
  "Add a connection (edge) between two nodes in a diagram",
  {
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
  async ({ id, source, target, label }) => {
    const diagram = storage.get(id);
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
    storage.save(diagram);

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

// ─── Tool: create_database_schema ────────────────────────────────────
server.tool(
  "create_database_schema",
  "Create a new diagram with database schema (ER diagram) using erDiagram mermaid syntax. Defines tables with columns and relationships between them.",
  {
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
  async ({ name, description, tables, relationships }) => {
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
    storage.save(diagram);
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

// ─── Tool: add_table_to_diagram ──────────────────────────────────────
server.tool(
  "add_table_to_diagram",
  "Add a database table (with columns) to an existing diagram's erDiagram mermaid code",
  {
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
  async ({ id, tableName, columns }) => {
    const diagram = storage.get(id);
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
    storage.save(diagram);

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

// ─── Tool: add_relationship_to_diagram ───────────────────────────────
server.tool(
  "add_relationship_to_diagram",
  "Add a relationship between two tables in an existing diagram's erDiagram",
  {
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
  async ({ id, from, to, label, cardinality }) => {
    const diagram = storage.get(id);
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

    code = code.trimEnd() + "\n" + relLine + "\n";
    diagram.mermaidCode = code;
    markDiagramFlowStale(diagram);
    diagram.updatedAt = new Date().toISOString();
    storage.save(diagram);

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
// GANTT CHART TOOLS
// ═══════════════════════════════════════════════════════════════════════

// ─── Tool: list_gantt_charts ─────────────────────────────────────────
server.tool("list_gantt_charts", "List all saved Gantt charts", {}, async () => {
  const charts = ganttStorage.list();
  const summary = charts.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    taskCount: c.tasks.length,
    updatedAt: c.updatedAt,
  }));
  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
});

// ─── Tool: get_gantt_chart ───────────────────────────────────────────
server.tool(
  "get_gantt_chart",
  "Get a Gantt chart by ID, returns tasks and metadata",
  { id: z.string().describe("The Gantt chart ID") },
  async ({ id }) => {
    const chart = ganttStorage.get(id);
    if (!chart) {
      return {
        content: [{ type: "text" as const, text: `Gantt chart not found: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(chart, null, 2) }],
    };
  }
);

// ─── Tool: create_gantt_chart ────────────────────────────────────────
server.tool(
  "create_gantt_chart",
  "Create a new Gantt chart with tasks for project planning. Each task has a name, start date, end date, status, priority, progress, and optional links to JIRA/GitHub.",
  {
    name: z.string().describe("Name of the Gantt chart"),
    description: z.string().optional().describe("Description of the chart"),
    tasks: z
      .array(
        z.object({
          name: z.string().describe("Task name"),
          startDate: z.string().describe("Start date (YYYY-MM-DD)"),
          endDate: z.string().describe("End date (YYYY-MM-DD)"),
          status: z
            .enum(["not-started", "in-progress", "completed", "blocked", "cancelled"])
            .optional()
            .default("not-started"),
          priority: z
            .enum(["low", "medium", "high", "critical"])
            .optional()
            .default("medium"),
          progress: z.number().min(0).max(100).optional().default(0),
          assignee: z.string().optional().describe("Person or team assigned"),
          group: z.string().optional().describe("Group/section name"),
          description: z.string().optional(),
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
        })
      )
      .optional()
      .default([]),
  },
  async ({ name, description, tasks }) => {
    const now = new Date().toISOString();
    const chart: GanttChart = {
      id: uuidv4(),
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
      tasks: tasks.map((t) => ({
        id: uuidv4(),
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status,
        priority: t.priority,
        progress: t.progress,
        assignee: t.assignee,
        group: t.group,
        description: t.description,
        links: t.links,
        dependencies: [],
        metadata: t.metadata,
      })),
    };
    ganttStorage.save(chart);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: chart.id, name: chart.name, taskCount: chart.tasks.length, message: "Gantt chart created" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: add_gantt_task ────────────────────────────────────────────
server.tool(
  "add_gantt_task",
  "Add a task to an existing Gantt chart",
  {
    chartId: z.string().describe("The Gantt chart ID"),
    name: z.string().describe("Task name"),
    startDate: z.string().describe("Start date (YYYY-MM-DD)"),
    endDate: z.string().describe("End date (YYYY-MM-DD)"),
    status: z
      .enum(["not-started", "in-progress", "completed", "blocked", "cancelled"])
      .optional()
      .default("not-started"),
    priority: z
      .enum(["low", "medium", "high", "critical"])
      .optional()
      .default("medium"),
    progress: z.number().min(0).max(100).optional().default(0),
    assignee: z.string().optional(),
    group: z.string().optional(),
    description: z.string().optional(),
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
  async ({ chartId, name, startDate, endDate, status, priority, progress, assignee, group, description, links, metadata }) => {
    const chart = ganttStorage.get(chartId);
    if (!chart) {
      return {
        content: [{ type: "text" as const, text: `Gantt chart not found: ${chartId}` }],
        isError: true,
      };
    }

    const task: GanttTask = {
      id: uuidv4(),
      name,
      startDate,
      endDate,
      status,
      priority,
      progress,
      assignee,
      group,
      description,
      links,
      dependencies: [],
      metadata,
    };

    chart.tasks.push(task);
    chart.updatedAt = new Date().toISOString();
    ganttStorage.save(chart);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { message: `Task '${name}' added`, taskId: task.id, chartId },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: update_gantt_task ─────────────────────────────────────────
server.tool(
  "update_gantt_task",
  "Update an existing task in a Gantt chart",
  {
    chartId: z.string().describe("The Gantt chart ID"),
    taskId: z.string().describe("The task ID to update"),
    name: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum(["not-started", "in-progress", "completed", "blocked", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    progress: z.number().min(0).max(100).optional(),
    assignee: z.string().optional(),
    group: z.string().optional(),
    description: z.string().optional(),
  },
  async ({ chartId, taskId, ...updates }) => {
    const chart = ganttStorage.get(chartId);
    if (!chart) {
      return {
        content: [{ type: "text" as const, text: `Gantt chart not found: ${chartId}` }],
        isError: true,
      };
    }

    const taskIdx = chart.tasks.findIndex((t) => t.id === taskId);
    if (taskIdx === -1) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }

    const task = chart.tasks[taskIdx];
    Object.assign(task, Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)));
    chart.updatedAt = new Date().toISOString();
    ganttStorage.save(chart);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task '${task.name}' updated`, task }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: add_link_to_gantt_task ────────────────────────────────────
server.tool(
  "add_link_to_gantt_task",
  "Add a link (JIRA, GitHub PR, etc.) to a task in a Gantt chart",
  {
    chartId: z.string().describe("The Gantt chart ID"),
    taskId: z.string().describe("The task ID"),
    label: z.string().describe("Link label (e.g. 'PROJ-123')"),
    url: z.string().url().describe("Link URL"),
    type: z
      .enum(["jira", "github-pr", "github-issue", "confluence", "slack", "other"])
      .describe("Type of link"),
  },
  async ({ chartId, taskId, label, url, type }) => {
    const chart = ganttStorage.get(chartId);
    if (!chart) {
      return {
        content: [{ type: "text" as const, text: `Gantt chart not found: ${chartId}` }],
        isError: true,
      };
    }

    const task = chart.tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }

    task.links.push({ label, url, type });
    chart.updatedAt = new Date().toISOString();
    ganttStorage.save(chart);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Link '${label}' added to task '${task.name}'` }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_gantt_chart ────────────────────────────────────────
server.tool(
  "delete_gantt_chart",
  "Delete a Gantt chart by ID",
  { id: z.string().describe("The Gantt chart ID") },
  async ({ id }) => {
    const deleted = ganttStorage.delete(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted ? `Gantt chart ${id} deleted` : `Gantt chart not found: ${id}`,
        },
      ],
      isError: !deleted,
    };
  }
);

// ─── Tool: list_sessions ─────────────────────────────────────────────
server.tool("list_sessions", "List all saved focus sessions", {}, async () => {
  const sessions = sessionStorage.list();
  const summary = sessions.map((s) => ({
    id: s.id,
    title: s.title,
    taskCount: s.tasks.length,
    pomodorosCompleted: s.pomodorosCompleted,
    updatedAt: s.updatedAt,
  }));
  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
});

// ─── Tool: get_session ───────────────────────────────────────────────
server.tool(
  "get_session",
  "Get a session by ID, returns tasks, links, notes, and metadata",
  { id: z.string().describe("The session ID") },
  async ({ id }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(session, null, 2) }],
    };
  }
);

// ─── Tool: create_session ────────────────────────────────────────────
server.tool(
  "create_session",
  "Create a new focus session with optional tasks and links",
  {
    title: z.string().describe("Title of the session"),
    notes: z.string().optional().default("").describe("Session notes"),
    tasks: z.array(z.string()).optional().default([]).describe("List of task strings"),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string().url(),
          type: z.enum(["diagram", "gantt", "matrix", "github", "other"]),
        })
      )
      .optional()
      .default([]),
  },
  async ({ title, notes, tasks, links }) => {
    const now = new Date().toISOString();
    const session: Session = {
      id: uuidv4(),
      title,
      notes,
      tasks,
      links,
      pomodorosCompleted: 0,
      createdAt: now,
      updatedAt: now,
    };
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: session.id, title: session.title, message: "Session created" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: update_session ────────────────────────────────────────────
server.tool(
  "update_session",
  "Update the title or notes of an existing session",
  {
    id: z.string().describe("The session ID"),
    title: z.string().optional(),
    notes: z.string().optional(),
  },
  async ({ id, title, notes }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    if (title !== undefined) session.title = title;
    if (notes !== undefined) session.notes = notes;
    session.updatedAt = new Date().toISOString();
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Session updated", id: session.id }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_session ────────────────────────────────────────────
server.tool(
  "delete_session",
  "Delete a session by ID",
  { id: z.string().describe("The session ID") },
  async ({ id }) => {
    const deleted = sessionStorage.delete(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted ? `Session ${id} deleted` : `Session not found: ${id}`,
        },
      ],
      isError: !deleted,
    };
  }
);

// ─── Tool: add_session_task ──────────────────────────────────────────
server.tool(
  "add_session_task",
  "Add a task string to an existing session",
  {
    id: z.string().describe("The session ID"),
    task: z.string().describe("Task description"),
  },
  async ({ id, task }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    session.tasks.push(task);
    session.updatedAt = new Date().toISOString();
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task added`, taskCount: session.tasks.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: remove_session_task ───────────────────────────────────────
server.tool(
  "remove_session_task",
  "Remove a task from a session by its index",
  {
    id: z.string().describe("The session ID"),
    index: z.number().int().min(0).describe("Zero-based task index"),
  },
  async ({ id, index }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    if (index >= session.tasks.length) {
      return {
        content: [{ type: "text" as const, text: `Task index out of range: ${index}` }],
        isError: true,
      };
    }
    session.tasks.splice(index, 1);
    session.updatedAt = new Date().toISOString();
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Task removed", taskCount: session.tasks.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: add_session_link ──────────────────────────────────────────
server.tool(
  "add_session_link",
  "Add a link to an existing session",
  {
    id: z.string().describe("The session ID"),
    label: z.string().describe("Link label"),
    url: z.string().url().describe("Link URL"),
    type: z.enum(["diagram", "gantt", "matrix", "github", "other"]).describe("Link type"),
  },
  async ({ id, label, url, type }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    session.links.push({ label, url, type });
    session.updatedAt = new Date().toISOString();
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Link '${label}' added`, linkCount: session.links.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: remove_session_link ───────────────────────────────────────
server.tool(
  "remove_session_link",
  "Remove a link from a session by its index",
  {
    id: z.string().describe("The session ID"),
    index: z.number().int().min(0).describe("Zero-based link index"),
  },
  async ({ id, index }) => {
    const session = sessionStorage.get(id);
    if (!session) {
      return {
        content: [{ type: "text" as const, text: `Session not found: ${id}` }],
        isError: true,
      };
    }
    if (index >= session.links.length) {
      return {
        content: [{ type: "text" as const, text: `Link index out of range: ${index}` }],
        isError: true,
      };
    }
    session.links.splice(index, 1);
    session.updatedAt = new Date().toISOString();
    sessionStorage.save(session);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Link removed", linkCount: session.links.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: list_matrix_boards ─────────────────────────────────────────
server.tool("list_matrix_boards", "List all saved Eisenhower matrix boards", {}, async () => {
  const boards = matrixStorage.list();
  const summary = boards.map((b) => ({
    id: b.id,
    name: b.name,
    taskCount: b.tasks.length,
    updatedAt: b.updatedAt,
  }));
  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
});

// ─── Tool: get_matrix_board ───────────────────────────────────────────
server.tool(
  "get_matrix_board",
  "Get an Eisenhower matrix board by ID",
  { id: z.string().describe("The matrix board ID") },
  async ({ id }) => {
    const board = matrixStorage.get(id);
    if (!board) {
      return {
        content: [{ type: "text" as const, text: `Matrix board not found: ${id}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(board, null, 2) }],
    };
  }
);

// ─── Tool: create_matrix_board ────────────────────────────────────────
server.tool(
  "create_matrix_board",
  "Create a new Eisenhower matrix board for task prioritization",
  {
    name: z.string().describe("Name of the matrix board"),
    tasks: z
      .array(
        z.object({
          title: z.string(),
          quadrant: z.enum(["do-first", "schedule", "delegate", "drop"]),
        })
      )
      .optional()
      .default([]),
  },
  async ({ name, tasks }) => {
    const now = new Date().toISOString();
    const board: MatrixBoard = {
      id: uuidv4(),
      name,
      createdAt: now,
      updatedAt: now,
      tasks: tasks.map((t) => ({
        id: uuidv4(),
        title: t.title,
        quadrant: t.quadrant,
        createdAt: now,
        updatedAt: now,
      })),
    };
    matrixStorage.save(board);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { id: board.id, name: board.name, taskCount: board.tasks.length, message: "Matrix board created" },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ─── Tool: update_matrix_board ────────────────────────────────────────
server.tool(
  "update_matrix_board",
  "Update the name of an existing matrix board",
  {
    id: z.string().describe("The matrix board ID"),
    name: z.string().describe("New name for the board"),
  },
  async ({ id, name }) => {
    const board = matrixStorage.get(id);
    if (!board) {
      return {
        content: [{ type: "text" as const, text: `Matrix board not found: ${id}` }],
        isError: true,
      };
    }
    board.name = name;
    board.updatedAt = new Date().toISOString();
    matrixStorage.save(board);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Matrix board updated", id: board.id }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: delete_matrix_board ────────────────────────────────────────
server.tool(
  "delete_matrix_board",
  "Delete a matrix board by ID",
  { id: z.string().describe("The matrix board ID") },
  async ({ id }) => {
    const deleted = matrixStorage.delete(id);
    return {
      content: [
        {
          type: "text" as const,
          text: deleted ? `Matrix board ${id} deleted` : `Matrix board not found: ${id}`,
        },
      ],
      isError: !deleted,
    };
  }
);

// ─── Tool: add_matrix_task ────────────────────────────────────────────
server.tool(
  "add_matrix_task",
  "Add a task to an Eisenhower matrix board",
  {
    boardId: z.string().describe("The matrix board ID"),
    title: z.string().describe("Task title"),
    quadrant: z
      .enum(["do-first", "schedule", "delegate", "drop"])
      .describe("Matrix quadrant: do-first (urgent+important), schedule (not urgent+important), delegate (urgent+not important), drop (not urgent+not important)"),
  },
  async ({ boardId, title, quadrant }) => {
    const board = matrixStorage.get(boardId);
    if (!board) {
      return {
        content: [{ type: "text" as const, text: `Matrix board not found: ${boardId}` }],
        isError: true,
      };
    }
    const now = new Date().toISOString();
    const task: MatrixTask = { id: uuidv4(), title, quadrant, createdAt: now, updatedAt: now };
    board.tasks.push(task);
    board.updatedAt = now;
    matrixStorage.save(board);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task '${title}' added`, taskId: task.id, boardId }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: update_matrix_task ─────────────────────────────────────────
server.tool(
  "update_matrix_task",
  "Update a task in a matrix board (title and/or quadrant)",
  {
    boardId: z.string().describe("The matrix board ID"),
    taskId: z.string().describe("The task ID"),
    title: z.string().optional(),
    quadrant: z.enum(["do-first", "schedule", "delegate", "drop"]).optional(),
  },
  async ({ boardId, taskId, title, quadrant }) => {
    const board = matrixStorage.get(boardId);
    if (!board) {
      return {
        content: [{ type: "text" as const, text: `Matrix board not found: ${boardId}` }],
        isError: true,
      };
    }
    const task = board.tasks.find((t) => t.id === taskId);
    if (!task) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    if (title !== undefined) task.title = title;
    if (quadrant !== undefined) task.quadrant = quadrant;
    task.updatedAt = new Date().toISOString();
    board.updatedAt = new Date().toISOString();
    matrixStorage.save(board);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: `Task '${task.title}' updated`, task }, null, 2),
        },
      ],
    };
  }
);

// ─── Tool: remove_matrix_task ─────────────────────────────────────────
server.tool(
  "remove_matrix_task",
  "Remove a task from a matrix board",
  {
    boardId: z.string().describe("The matrix board ID"),
    taskId: z.string().describe("The task ID to remove"),
  },
  async ({ boardId, taskId }) => {
    const board = matrixStorage.get(boardId);
    if (!board) {
      return {
        content: [{ type: "text" as const, text: `Matrix board not found: ${boardId}` }],
        isError: true,
      };
    }
    const before = board.tasks.length;
    board.tasks = board.tasks.filter((t) => t.id !== taskId);
    if (board.tasks.length === before) {
      return {
        content: [{ type: "text" as const, text: `Task not found: ${taskId}` }],
        isError: true,
      };
    }
    board.updatedAt = new Date().toISOString();
    matrixStorage.save(board);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ message: "Task removed", taskCount: board.tasks.length }, null, 2),
        },
      ],
    };
  }
);

// ─── Resources: diagram listing ──────────────────────────────────────
server.resource("diagrams", "archdiagram://diagrams", async (uri) => {
  const diagrams = storage.list();
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

// ─── Resources: Gantt chart listing ──────────────────────────────────
server.resource("gantt-charts", "archdiagram://gantt-charts", async (uri) => {
  const charts = ganttStorage.list();
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          charts.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            taskCount: c.tasks.length,
          })),
          null,
          2
        ),
      },
    ],
  };
});

// ─── Resources: Sessions listing ─────────────────────────────────────
server.resource("sessions", "archdiagram://sessions", async (uri) => {
  const sessions = sessionStorage.list();
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          sessions.map((s) => ({
            id: s.id,
            title: s.title,
            taskCount: s.tasks.length,
            pomodorosCompleted: s.pomodorosCompleted,
          })),
          null,
          2
        ),
      },
    ],
  };
});

// ─── Resources: Matrix board listing ─────────────────────────────────
server.resource("matrix-boards", "archdiagram://matrix-boards", async (uri) => {
  const boards = matrixStorage.list();
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          boards.map((b) => ({
            id: b.id,
            name: b.name,
            taskCount: b.tasks.length,
          })),
          null,
          2
        ),
      },
    ],
  };
});

// ─── Start the server ────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ArchDiagram MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
