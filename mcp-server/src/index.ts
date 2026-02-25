#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { DiagramStorage, GanttStorage } from "./storage.js";
import type { Diagram, GanttChart, GanttTask } from "./types.js";

const storage = new DiagramStorage(process.env.DIAGRAMS_DIR);
const ganttStorage = new GanttStorage(storage.baseDir);

const server = new McpServer({
  name: "archdiagram",
  version: "1.0.0",
});

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

    const updated: Diagram = {
      ...existing,
      name: name ?? existing.name,
      description: description ?? existing.description,
      mermaidCode: mermaidCode ?? existing.mermaidCode,
      updatedAt: new Date().toISOString(),
    };
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
    nodeId: z.string().describe("Unique node identifier (e.g. 'api_gateway')"),
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
    const nodeLine = `    ${formatter(nodeId, fullLabel)}`;

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
    source: z.string().describe("Source node ID"),
    target: z.string().describe("Target node ID"),
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

    const edgeLine = label
      ? `    ${source} -->|${label}| ${target}`
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
      const safeName = table.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
      lines.push(`    ${safeName} {`);
      for (const col of table.columns) {
        const constraintStr = col.constraint
          ? ` ${col.constraint.toUpperCase()}`
          : "";
        lines.push(`        ${col.type} ${col.name}${constraintStr}`);
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
        const from = rel.from.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        const to = rel.to.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        const card = cardinalityMap[rel.cardinality ?? "one-to-many"] ?? "||--o{";
        lines.push(`    ${from} ${card} ${to} : "${rel.label}"`);
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

    const safeName = tableName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    const tableLines: string[] = [];
    tableLines.push(`    ${safeName} {`);
    for (const col of columns) {
      const constraintStr = col.constraint
        ? ` ${col.constraint.toUpperCase()}`
        : "";
      tableLines.push(`        ${col.type} ${col.name}${constraintStr}`);
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
    const safeFrom = from.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const safeTo = to.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const card = cardinalityMap[cardinality ?? "one-to-many"] ?? "||--o{";
    const relLine = `    ${safeFrom} ${card} ${safeTo} : "${label}"`;

    // Ensure erDiagram section exists
    let code = diagram.mermaidCode;
    if (!code.includes("erDiagram")) {
      code = code.trimEnd() + "\n\nerDiagram\n";
    }

    code = code.trimEnd() + "\n" + relLine + "\n";
    diagram.mermaidCode = code;
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
                url: z.string(),
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
          url: z.string(),
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
    url: z.string().describe("Link URL"),
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
