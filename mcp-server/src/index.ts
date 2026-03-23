#!/usr/bin/env node

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  getDb,
  updateDiagramNodeDetails as dbUpdateDiagramNodeDetails,
  updateDiagramEdgeDetails as dbUpdateDiagramEdgeDetails,
  listTroubleshootingSessions as dbListTroubleshootingSessions,
  getTroubleshootingSessionById as dbGetTroubleshootingSession,
  createTroubleshootingSession as dbCreateTroubleshootingSession,
  updateTroubleshootingSession as dbUpdateTroubleshootingSession,
  appendSessionTimelineEntry as dbAppendTimelineEntry,
  appendSessionComment as dbAppendSessionComment,
  appendSessionCommand as dbAppendSessionCommand,
  extractKnowledgePattern as dbExtractKnowledgePattern,
  listArtifacts as dbListArtifacts,
  getArtifactById as dbGetArtifactById,
  listKnowledgePatterns as dbListKnowledgePatterns,
  getPlanViewKnowledgePatternById as dbGetKnowledgePatternById,
  searchTroubleshootingMemory as dbSearchTroubleshootingMemory,
  listDiagrams as dbListDiagrams,
  getDiagramById as dbGetDiagram,
  upsertDiagram as dbSaveDiagram,
  deleteDiagram as dbDeleteDiagram,
  saveArtifactFile as dbSaveArtifactFile,
} from "./db.js";
import type { Diagram } from "./types.js";
import {
  createDiagramDraft,
  createTroubleshootingSessionDraft,
} from "../../shared/planview/application.js";
import { NODE_SHAPE_TYPES } from "../../shared/planview/domain.js";
import {
  toArtifactResourceSummary,
  toDiagramResourceSummary,
  toTroubleshootingSessionResourceSummary,
} from "../../shared/planview/projections.js";
import {
  edgeMetadataSchema,
  nodeMetadataSchema,
  patternExtractionSchema,
  sessionCommandSchema,
  sessionCommentSchema,
  timelineEntrySchema,
  troubleshootingSessionCreateSchema,
  troubleshootingSessionPatchSchema,
} from "../../shared/planview/validation.js";
import {
  appendDiagramEdge,
  appendDiagramNode,
  appendErRelationship,
  appendErTable,
  buildDatabaseSchemaMermaid,
  rebuildGraphFromMermaid,
} from "./mermaidMutations.js";

// Ensure DB is initialized
getDb();
const MERMAID_NODE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

const server = new McpServer({
  name: "planview",
  version: "2.0.0",
});

function toolSuccess(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function toolError(code: string, message: string, details?: Record<string, unknown>) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify({ error: message, code, details }, null, 2),
      },
    ],
    isError: true,
  };
}

// ─── Tool: list_diagrams ─────────────────────────────────────────────
server.registerTool("list_diagrams", {
  title: "List Diagrams",
  description: "List all saved diagrams",
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async () => {
  const diagrams = dbListDiagrams();
  const summary = diagrams.map((diagram) => toDiagramResourceSummary(diagram));
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
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }
    return toolSuccess(diagram);
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
    const diagram = createDiagramDraft({
      id: uuidv4(),
      name,
      description: description ?? "",
      mermaidCode,
      createdAt: now,
    });
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
    try {
      const existing = dbGetDiagram(id);
      if (!existing) {
        return toolError("diagram_not_found", `Diagram not found: ${id}`);
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
      const persisted = mermaidChanged ? dbSaveDiagram(rebuildGraphFromMermaid(updated, nextMermaidCode)) : dbSaveDiagram(updated);
      return toolSuccess({ id: persisted.id, name: persisted.name, revision: persisted.revision, message: "Diagram updated" });
    } catch (error) {
      const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
      return toolError(planViewError.code ?? "diagram_update_failed", planViewError.message ?? "Failed to update diagram", planViewError.details);
    }
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
    if (!deleted) {
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }
    return toolSuccess({ id, message: "Diagram deleted" });
  }
);

server.registerTool("get_diagram_metadata", {
  title: "Get Diagram Metadata",
  description: "Return diagram summary plus node and edge metadata records",
  inputSchema: {
    id: z.string().describe("The diagram ID"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ id }) => {
  const diagram = dbGetDiagram(id);
  if (!diagram) {
    return toolError("diagram_not_found", `Diagram not found: ${id}`);
  }

  return toolSuccess({
    id: diagram.id,
    name: diagram.name,
    description: diagram.description,
    revision: diagram.revision,
    nodeCount: diagram.nodeCount,
    edgeCount: diagram.edgeCount,
    sessionCount: diagram.sessionCount,
    openSessionCount: diagram.openSessionCount,
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      label: node.data.label,
      metadata: node.data.metadata ?? null,
    })),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label ?? edge.label ?? "",
      metadata: edge.data?.metadata ?? null,
    })),
  });
});

server.registerTool("update_diagram_node_metadata", {
  title: "Update Diagram Node Metadata",
  description: "Safely update rich metadata for a single node in a diagram",
  inputSchema: {
    diagramId: z.string().describe("The diagram ID"),
    nodeId: z.string().describe("The node ID"),
    metadata: nodeMetadataSchema,
    expectedRevision: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ diagramId, nodeId, metadata, expectedRevision }) => {
  try {
    const diagram = dbUpdateDiagramNodeDetails(diagramId, nodeId, metadata, expectedRevision);
    return toolSuccess({
      diagramId: diagram.id,
      nodeId,
      revision: diagram.revision,
      message: "Node metadata updated",
    });
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "node_update_failed", planViewError.message ?? "Failed to update node metadata", planViewError.details);
  }
});

server.registerTool("update_diagram_edge_metadata", {
  title: "Update Diagram Edge Metadata",
  description: "Safely update dependency metadata for a single edge in a diagram",
  inputSchema: {
    diagramId: z.string().describe("The diagram ID"),
    edgeId: z.string().describe("The edge ID"),
    metadata: edgeMetadataSchema,
    expectedRevision: z.number().int().positive().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ diagramId, edgeId, metadata, expectedRevision }) => {
  try {
    const diagram = dbUpdateDiagramEdgeDetails(diagramId, edgeId, metadata, expectedRevision);
    return toolSuccess({
      diagramId: diagram.id,
      edgeId,
      revision: diagram.revision,
      message: "Edge metadata updated",
    });
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "edge_update_failed", planViewError.message ?? "Failed to update edge metadata", planViewError.details);
  }
});

server.registerTool("create_troubleshooting_session", {
  title: "Create Troubleshooting Session",
  description: "Create a new investigation linked to a diagram and affected graph entities",
  inputSchema: troubleshootingSessionCreateSchema.shape,
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async (args: z.infer<typeof troubleshootingSessionCreateSchema>) => {
  try {
    const input = troubleshootingSessionCreateSchema.parse(args);
    const session = dbCreateTroubleshootingSession(
      createTroubleshootingSessionDraft({
        id: input.id,
        diagramId: input.diagramId,
        title: input.title,
        summary: input.summary,
        projectId: input.projectId ?? null,
        systemScope: input.systemScope,
        status: input.status,
        linkedNodeIds: input.linkedNodeIds,
        linkedEdgeIds: input.linkedEdgeIds,
        notesMarkdown: input.notesMarkdown,
        hypotheses: input.hypotheses,
        aiTranscriptReferences: input.aiTranscriptReferences,
        resolutionSummary: input.resolutionSummary,
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
      })
    );
    return toolSuccess(session);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "session_create_failed", planViewError.message ?? "Failed to create troubleshooting session", planViewError.details);
  }
});

server.registerTool("list_troubleshooting_sessions", {
  title: "List Troubleshooting Sessions",
  description: "List troubleshooting sessions filtered by diagram, node, edge, or search term",
  inputSchema: {
    diagramId: z.string().optional(),
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    q: z.string().optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ diagramId, nodeId, edgeId, q }) => {
  return toolSuccess(dbListTroubleshootingSessions({ diagramId, nodeId, edgeId, q }));
});

server.registerTool("get_troubleshooting_session", {
  title: "Get Troubleshooting Session",
  description: "Get a single troubleshooting session by ID",
  inputSchema: { id: z.string().describe("The troubleshooting session ID") },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ id }) => {
  const session = dbGetTroubleshootingSession(id);
  if (!session) {
    return toolError("session_not_found", `Troubleshooting session not found: ${id}`);
  }
  return toolSuccess(session);
});

server.registerTool("update_troubleshooting_session", {
  title: "Update Troubleshooting Session",
  description: "Update summary fields, linked entities, notes, hypotheses, or resolution for a troubleshooting session",
  inputSchema: {
    id: z.string(),
    ...troubleshootingSessionPatchSchema.shape,
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ id, ...patch }: { id: string } & z.infer<typeof troubleshootingSessionPatchSchema>) => {
  try {
    const input = troubleshootingSessionPatchSchema.parse(patch);
    return toolSuccess(dbUpdateTroubleshootingSession(id, input));
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "session_update_failed", planViewError.message ?? "Failed to update troubleshooting session", planViewError.details);
  }
});

server.registerTool("append_session_timeline_entry", {
  title: "Append Session Timeline Entry",
  description: "Append a timeline entry to a troubleshooting session",
  inputSchema: {
    sessionId: z.string(),
    entry: timelineEntrySchema,
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ sessionId, entry }) => {
  try {
    const created = dbAppendTimelineEntry(sessionId, timelineEntrySchema.parse(entry));
    return toolSuccess(created);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "timeline_append_failed", planViewError.message ?? "Failed to append timeline entry", planViewError.details);
  }
});

server.registerTool("append_session_comment", {
  title: "Append Session Comment",
  description: "Append a comment to a troubleshooting session",
  inputSchema: {
    sessionId: z.string(),
    comment: sessionCommentSchema,
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ sessionId, comment }) => {
  try {
    const created = dbAppendSessionComment(sessionId, sessionCommentSchema.parse(comment));
    return toolSuccess(created);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "comment_append_failed", planViewError.message ?? "Failed to append session comment", planViewError.details);
  }
});

server.registerTool("append_session_command", {
  title: "Append Session Command",
  description: "Append a command record to a troubleshooting session",
  inputSchema: {
    sessionId: z.string(),
    command: sessionCommandSchema,
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ sessionId, command }) => {
  try {
    const created = dbAppendSessionCommand(sessionId, sessionCommandSchema.parse(command));
    return toolSuccess(created);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "command_append_failed", planViewError.message ?? "Failed to append session command", planViewError.details);
  }
});

server.registerTool("link_session_to_entities", {
  title: "Link Session To Entities",
  description: "Update the set of linked nodes and edges for a troubleshooting session",
  inputSchema: {
    sessionId: z.string(),
    linkedNodeIds: z.array(z.string()).default([]),
    linkedEdgeIds: z.array(z.string()).default([]),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ sessionId, linkedNodeIds, linkedEdgeIds }) => {
  try {
    const updated = dbUpdateTroubleshootingSession(sessionId, { linkedNodeIds, linkedEdgeIds });
    return toolSuccess(updated);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "session_link_failed", planViewError.message ?? "Failed to link session entities", planViewError.details);
  }
});

server.registerTool("extract_knowledge_pattern", {
  title: "Extract Knowledge Pattern",
  description: "Extract a reusable troubleshooting pattern from a resolved troubleshooting session",
  inputSchema: {
    sessionId: z.string(),
    pattern: patternExtractionSchema,
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ sessionId, pattern }) => {
  try {
    const session = dbGetTroubleshootingSession(sessionId);
    if (!session) {
      return toolError("session_not_found", `Troubleshooting session not found: ${sessionId}`);
    }
    const input = patternExtractionSchema.parse(pattern);
    const sessionSummary = toTroubleshootingSessionResourceSummary(session);
    const extracted = dbExtractKnowledgePattern(sessionId, {
      title: input.title,
      summary: input.summary,
      symptom: input.symptom,
      resolution: input.resolution,
      tags: input.tags,
      linkedNodeIds: sessionSummary.linkedNodeIds,
      linkedEdgeIds: sessionSummary.linkedEdgeIds,
    });
    return toolSuccess(extracted);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "pattern_extract_failed", planViewError.message ?? "Failed to extract knowledge pattern", planViewError.details);
  }
});

server.registerTool("search_troubleshooting_memory", {
  title: "Search Troubleshooting Memory",
  description: "Search troubleshooting sessions and reusable patterns by text and affected graph entities",
  inputSchema: {
    q: z.string(),
    diagramId: z.string().optional(),
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    limit: z.number().int().positive().max(100).optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ q, diagramId, nodeId, edgeId, limit }) => {
  return toolSuccess(dbSearchTroubleshootingMemory({ q, diagramId, nodeId, edgeId, limit }));
});

server.registerTool("list_knowledge_patterns", {
  title: "List Knowledge Patterns",
  description: "List extracted troubleshooting patterns",
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async () => {
  return toolSuccess(dbListKnowledgePatterns());
});

server.registerTool("list_artifacts", {
  title: "List Artifacts",
  description: "List stored evidence artifacts by owner, diagram, or label",
  inputSchema: {
    ownerType: z.enum(["node", "edge", "session"]).optional(),
    ownerId: z.string().optional(),
    diagramId: z.string().optional(),
    q: z.string().optional(),
    limit: z.number().int().positive().max(500).optional(),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ ownerType, ownerId, diagramId, q, limit }) => {
  return toolSuccess(dbListArtifacts({ ownerType, ownerId, diagramId, q, limit }));
});

server.registerTool("get_artifact_metadata", {
  title: "Get Artifact Metadata",
  description: "Get metadata for a single evidence artifact",
  inputSchema: {
    artifactId: z.string().describe("Artifact ID"),
  },
  annotations: { readOnlyHint: true, destructiveHint: false },
}, async ({ artifactId }) => {
  try {
    const artifact = dbGetArtifactById(artifactId);
    if (!artifact) {
      return toolError("artifact_not_found", `Artifact not found: ${artifactId}`);
    }
    return toolSuccess(toArtifactResourceSummary(artifact));
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "artifact_read_failed", planViewError.message ?? "Failed to load artifact metadata", planViewError.details);
  }
});

server.registerTool("attach_artifact", {
  title: "Attach Artifact",
  description: "Attach a text or binary artifact to a troubleshooting session, node, or edge",
  inputSchema: {
    ownerType: z.enum(["node", "edge", "session"]),
    ownerId: z.string(),
    diagramId: z.string().optional(),
    label: z.string().optional(),
    fileName: z.string().min(1),
    mimeType: z.string().optional(),
    contentBase64: z.string().min(1).describe("Base64-encoded artifact bytes"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ ownerType, ownerId, diagramId, label, fileName, mimeType, contentBase64 }) => {
  try {
    const bytes = Buffer.from(contentBase64, "base64");
    if (bytes.byteLength === 0) {
      return toolError("artifact_empty", "Artifact content must not be empty.");
    }
    const artifact = await dbSaveArtifactFile({
      ownerType,
      ownerId,
      diagramId,
      label,
      fileName,
      mimeType: mimeType ?? "application/octet-stream",
      bytes,
    });
    return toolSuccess(artifact);
  } catch (error) {
    const planViewError = error as { code?: string; message?: string; details?: Record<string, unknown> };
    return toolError(planViewError.code ?? "artifact_attach_failed", planViewError.message ?? "Failed to attach artifact", planViewError.details);
  }
});

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
      .enum(NODE_SHAPE_TYPES)
      .describe("The shape type for the node"),
    description: z.string().optional().describe("Optional description"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false },
}, async ({ id, nodeId, label, shapeType, description }) => {
    const diagram = dbGetDiagram(id);
    if (!diagram) {
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }

    const persisted = dbSaveDiagram(
      appendDiagramNode(diagram, { nodeId, label, shapeType, description })
    );

    return toolSuccess({ message: `Node '${nodeId}' added`, mermaidCode: persisted.mermaidCode, revision: persisted.revision });
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
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }

    const persisted = dbSaveDiagram(appendDiagramEdge(diagram, { source, target, label }));

    return toolSuccess({
      message: `Edge ${source} -> ${target} added`,
      mermaidCode: persisted.mermaidCode,
      revision: persisted.revision,
    });
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
    const diagram = createDiagramDraft({
      id: uuidv4(),
      name,
      description: description ?? "",
      mermaidCode: buildDatabaseSchemaMermaid({ tables, relationships }),
      createdAt: new Date().toISOString(),
    });
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
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }

    const persisted = dbSaveDiagram(appendErTable(diagram, { name: tableName, columns }));

    return toolSuccess({
      message: `Table '${tableName}' added`,
      mermaidCode: persisted.mermaidCode,
      revision: persisted.revision,
    });
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
      return toolError("diagram_not_found", `Diagram not found: ${id}`);
    }

    const persisted = dbSaveDiagram(
      appendErRelationship(diagram, { from, to, label, cardinality })
    );

    return toolSuccess({
      message: `Relationship ${from} -> ${to} added`,
      mermaidCode: persisted.mermaidCode,
      revision: persisted.revision,
    });
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
        text: JSON.stringify(diagrams.map((diagram) => toDiagramResourceSummary(diagram)), null, 2),
      },
    ],
  };
});

server.registerResource(
  "diagram",
  new ResourceTemplate("planview://diagrams/{diagramId}", {
    list: async () => ({
      resources: dbListDiagrams().map((diagram) => ({
        uri: `planview://diagrams/${diagram.id}`,
        name: diagram.name,
      })),
    }),
  }),
  {
    title: "Diagram Details",
    description: "Full diagram document with graph, metadata, and troubleshooting counts",
    mimeType: "application/json",
  },
  async (uri, { diagramId }) => {
    const diagram = dbGetDiagram(String(diagramId));
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: diagram
            ? JSON.stringify(diagram, null, 2)
            : JSON.stringify({ error: "Diagram not found" }, null, 2),
        },
      ],
    };
  }
);

server.registerResource("investigations", "planview://investigations", {
  title: "All Investigations",
  description: "List of troubleshooting sessions in the workspace",
  mimeType: "application/json",
}, async (uri) => {
  const sessions = dbListTroubleshootingSessions().map((session) => ({
    ...toTroubleshootingSessionResourceSummary(session),
  }));
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(sessions, null, 2),
      },
    ],
  };
});

server.registerResource(
  "investigation",
  new ResourceTemplate("planview://investigations/{sessionId}", {
    list: async () => ({
      resources: dbListTroubleshootingSessions().map((session) => ({
        uri: `planview://investigations/${session.id}`,
        name: session.title,
      })),
    }),
  }),
  {
    title: "Investigation Details",
    description: "Full troubleshooting session with links, notes, commands, and artifacts",
    mimeType: "application/json",
  },
  async (uri, { sessionId }) => {
    const session = dbGetTroubleshootingSession(String(sessionId));
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: session
            ? JSON.stringify(session, null, 2)
            : JSON.stringify({ error: "Troubleshooting session not found" }, null, 2),
        },
      ],
    };
  }
);

server.registerResource("patterns", "planview://patterns", {
  title: "Reusable Patterns",
  description: "Extracted troubleshooting memory patterns",
  mimeType: "application/json",
}, async (uri) => {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(dbListKnowledgePatterns(), null, 2),
      },
    ],
  };
});

server.registerResource(
  "pattern",
  new ResourceTemplate("planview://patterns/{patternId}", {
    list: async () => ({
      resources: dbListKnowledgePatterns().map((pattern) => ({
        uri: `planview://patterns/${pattern.id}`,
        name: pattern.title,
      })),
    }),
  }),
  {
    title: "Pattern Details",
    description: "Full reusable troubleshooting pattern",
    mimeType: "application/json",
  },
  async (uri, { patternId }) => {
    const pattern = dbGetKnowledgePatternById(String(patternId));
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: pattern
            ? JSON.stringify(pattern, null, 2)
            : JSON.stringify({ error: "Knowledge pattern not found" }, null, 2),
        },
      ],
    };
  }
);

server.registerResource("artifacts", "planview://artifacts", {
  title: "Artifacts",
  description: "Stored evidence artifact metadata",
  mimeType: "application/json",
}, async (uri) => {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(
          dbListArtifacts({ limit: 200 }).map((artifact) => toArtifactResourceSummary(artifact)),
          null,
          2
        ),
      },
    ],
  };
});

server.registerResource(
  "artifact",
  new ResourceTemplate("planview://artifacts/{artifactId}", {
    list: async () => ({
      resources: dbListArtifacts({ limit: 200 }).map((artifact) => ({
        uri: `planview://artifacts/${artifact.id}`,
        name: artifact.label,
      })),
    }),
  }),
  {
    title: "Artifact Metadata",
    description: "Metadata for a single evidence artifact",
    mimeType: "application/json",
  },
  async (uri, { artifactId }) => {
    try {
      const artifact = dbGetArtifactById(String(artifactId));
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: artifact
              ? JSON.stringify(toArtifactResourceSummary(artifact), null, 2)
              : JSON.stringify({ error: "Artifact not found" }, null, 2),
          },
        ],
      };
    } catch (error) {
      const planViewError = error as { code?: string; message?: string };
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                error: planViewError.message ?? "Failed to load artifact metadata",
                code: planViewError.code ?? "artifact_read_failed",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  }
);

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
