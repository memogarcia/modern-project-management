import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  deleteDiagram as dbDeleteDiagram,
  getDiagramById as dbGetDiagram,
  listDiagrams as dbListDiagrams,
  updateDiagramEdgeDetails as dbUpdateDiagramEdgeDetails,
  updateDiagramNodeDetails as dbUpdateDiagramNodeDetails,
  upsertDiagram as dbSaveDiagram,
} from "../db.js";
import type { Diagram } from "../types.js";
import { createDiagramDraft } from "../../../shared/planview/application.js";
import { NODE_SHAPE_TYPES } from "../../../shared/planview/domain.js";
import { buildDatabaseSchemaMermaid, rebuildGraphFromMermaid } from "../../../shared/planview/mermaidMutations.js";
import {
  toDiagramResourceSummary,
} from "../../../shared/planview/projections.js";
import {
  diagramEdgeMetadataPatchSchema,
  diagramNodeMetadataPatchSchema,
  edgeMetadataSchema,
  nodeMetadataSchema,
} from "../../../shared/planview/validation.js";
import { appendDiagramEdge, appendDiagramNode, appendErRelationship, appendErTable } from "../mermaidMutations.js";
import { abortTool, assertFound, registerJsonTool } from "../toolkit.js";

const MERMAID_NODE_ID_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function requireDiagram(id: string) {
  return assertFound(dbGetDiagram(id), "diagram_not_found", `Diagram not found: ${id}`) as Diagram;
}

export function registerDiagramTools(server: McpServer): void {
  registerJsonTool(
    server,
    "list_diagrams",
    {
      title: "List Diagrams",
      description: "List all saved diagrams",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    () => dbListDiagrams().map((diagram) => toDiagramResourceSummary(diagram))
  );

  registerJsonTool(
    server,
    "get_diagram",
    {
      title: "Get Diagram",
      description: "Get a diagram by ID, returns full mermaid code and metadata",
      inputSchema: { id: z.string().describe("The diagram ID") },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ id }: { id: string }) => requireDiagram(id)
  );

  registerJsonTool(
    server,
    "create_diagram",
    {
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
    },
    ({ name, description, mermaidCode }: { name: string; description?: string; mermaidCode: string }) => {
      const diagram = createDiagramDraft({
        id: uuidv4(),
        name,
        description: description ?? "",
        mermaidCode,
        createdAt: new Date().toISOString(),
      });
      dbSaveDiagram(diagram);
      return { id: diagram.id, name: diagram.name, message: "Diagram created" };
    }
  );

  registerJsonTool(
    server,
    "update_diagram",
    {
      title: "Update Diagram",
      description: "Update an existing diagram's mermaid code, name, or description",
      inputSchema: {
        id: z.string().describe("The diagram ID"),
        name: z.string().optional().describe("New name"),
        description: z.string().optional().describe("New description"),
        mermaidCode: z.string().optional().describe("New mermaid code"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ id, name, description, mermaidCode }: {
      id: string;
      name?: string;
      description?: string;
      mermaidCode?: string;
    }) => {
      const existing = requireDiagram(id);
      const nextMermaidCode = mermaidCode ?? existing.mermaidCode;
      const mermaidChanged = mermaidCode !== undefined && mermaidCode !== existing.mermaidCode;
      const updated: Diagram = {
        ...existing,
        name: name ?? existing.name,
        description: description ?? existing.description,
        mermaidCode: nextMermaidCode,
        updatedAt: new Date().toISOString(),
      };
      const persisted = mermaidChanged
        ? dbSaveDiagram(rebuildGraphFromMermaid(updated, nextMermaidCode))
        : dbSaveDiagram(updated);
      return { id: persisted.id, name: persisted.name, revision: persisted.revision, message: "Diagram updated" };
    },
    { fallbackCode: "diagram_update_failed", fallbackMessage: "Failed to update diagram" }
  );

  registerJsonTool(
    server,
    "delete_diagram",
    {
      title: "Delete Diagram",
      description: "Delete a diagram by ID",
      inputSchema: { id: z.string().describe("The diagram ID") },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ id }: { id: string }) => {
      if (!dbDeleteDiagram(id)) {
        abortTool("diagram_not_found", `Diagram not found: ${id}`);
      }
      return { id, message: "Diagram deleted" };
    }
  );

  registerJsonTool(
    server,
    "get_diagram_metadata",
    {
      title: "Get Diagram Metadata",
      description: "Return diagram summary plus node and edge metadata records",
      inputSchema: { id: z.string().describe("The diagram ID") },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ id }: { id: string }) => {
      const diagram = requireDiagram(id);
      return {
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
      };
    }
  );

  registerJsonTool(
    server,
    "update_diagram_node_metadata",
    {
      title: "Update Diagram Node Metadata",
      description: "Safely update rich metadata for a single node in a diagram",
      inputSchema: {
        diagramId: z.string().describe("The diagram ID"),
        nodeId: z.string().describe("The node ID"),
        metadata: nodeMetadataSchema,
        expectedRevision: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ diagramId, nodeId, metadata, expectedRevision }: {
      diagramId: string;
      nodeId: string;
      metadata: z.infer<typeof diagramNodeMetadataPatchSchema>["metadata"];
      expectedRevision?: number;
    }) => {
      const diagram = dbUpdateDiagramNodeDetails(diagramId, nodeId, metadata, expectedRevision);
      return { diagramId: diagram.id, nodeId, revision: diagram.revision, message: "Node metadata updated" };
    },
    { fallbackCode: "node_update_failed", fallbackMessage: "Failed to update node metadata" }
  );

  registerJsonTool(
    server,
    "update_diagram_edge_metadata",
    {
      title: "Update Diagram Edge Metadata",
      description: "Safely update dependency metadata for a single edge in a diagram",
      inputSchema: {
        diagramId: z.string().describe("The diagram ID"),
        edgeId: z.string().describe("The edge ID"),
        metadata: edgeMetadataSchema,
        expectedRevision: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ diagramId, edgeId, metadata, expectedRevision }: {
      diagramId: string;
      edgeId: string;
      metadata: z.infer<typeof diagramEdgeMetadataPatchSchema>["metadata"];
      expectedRevision?: number;
    }) => {
      const diagram = dbUpdateDiagramEdgeDetails(diagramId, edgeId, metadata, expectedRevision);
      return { diagramId: diagram.id, edgeId, revision: diagram.revision, message: "Edge metadata updated" };
    },
    { fallbackCode: "edge_update_failed", fallbackMessage: "Failed to update edge metadata" }
  );

  registerJsonTool(
    server,
    "add_node_to_diagram",
    {
      title: "Add Node to Diagram",
      description: "Add a new node (component) to a diagram's mermaid code",
      inputSchema: {
        id: z.string().describe("The diagram ID"),
        nodeId: z
          .string()
          .regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID")
          .describe("Unique node identifier (e.g. 'api_gateway')"),
        label: z.string().describe("Display label for the node"),
        shapeType: z.enum(NODE_SHAPE_TYPES).describe("The shape type for the node"),
        description: z.string().optional().describe("Optional description"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ id, nodeId, label, shapeType, description }: {
      id: string;
      nodeId: string;
      label: string;
      shapeType: (typeof NODE_SHAPE_TYPES)[number];
      description?: string;
    }) => {
      const persisted = dbSaveDiagram(
        appendDiagramNode(requireDiagram(id), { nodeId, label, shapeType, description })
      );
      return { message: `Node '${nodeId}' added`, mermaidCode: persisted.mermaidCode, revision: persisted.revision };
    }
  );

  registerJsonTool(
    server,
    "add_edge_to_diagram",
    {
      title: "Add Edge to Diagram",
      description: "Add a connection (edge) between two nodes in a diagram",
      inputSchema: {
        id: z.string().describe("The diagram ID"),
        source: z.string().regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID").describe("Source node ID"),
        target: z.string().regex(MERMAID_NODE_ID_RE, "Invalid Mermaid node ID").describe("Target node ID"),
        label: z.string().optional().describe("Optional edge label (e.g. 'HTTP', 'gRPC')"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ id, source, target, label }: { id: string; source: string; target: string; label?: string }) => {
      const persisted = dbSaveDiagram(appendDiagramEdge(requireDiagram(id), { source, target, label }));
      return { message: `Edge ${source} -> ${target} added`, mermaidCode: persisted.mermaidCode, revision: persisted.revision };
    }
  );

  registerJsonTool(
    server,
    "create_database_schema",
    {
      title: "Create Database Schema",
      description: "Create a new diagram with database schema (ER diagram) using erDiagram mermaid syntax. Defines tables with columns and relationships between them.",
      inputSchema: {
        name: z.string().describe("Name of the diagram"),
        description: z.string().optional().describe("Description of the diagram"),
        tables: z.array(
          z.object({
            name: z.string().describe("Table name (e.g. 'users', 'orders')"),
            columns: z.array(
              z.object({
                name: z.string().describe("Column name"),
                type: z.string().describe("Column type (e.g. 'int', 'varchar', 'timestamp')"),
                constraint: z.enum(["primary", "foreign", "unique", "nullable"]).optional().describe("Column constraint"),
              })
            ),
          })
        ).describe("Array of table definitions"),
        relationships: z.array(
          z.object({
            from: z.string().describe("Source table name"),
            to: z.string().describe("Target table name"),
            label: z.string().describe("Relationship label (e.g. 'has many', 'belongs to')"),
            cardinality: z.enum(["one-to-one", "one-to-many", "many-to-many"]).optional().default("one-to-many").describe("Relationship cardinality"),
          })
        ).optional().describe("Relationships between tables"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ name, description, tables, relationships }: {
      name: string;
      description?: string;
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
    }) => {
      const diagram = createDiagramDraft({
        id: uuidv4(),
        name,
        description: description ?? "",
        mermaidCode: buildDatabaseSchemaMermaid({ tables, relationships }),
        createdAt: new Date().toISOString(),
      });
      dbSaveDiagram(diagram);
      return {
        id: diagram.id,
        name: diagram.name,
        message: "Database schema diagram created",
        mermaidCode: diagram.mermaidCode,
      };
    }
  );

  registerJsonTool(
    server,
    "add_table_to_diagram",
    {
      title: "Add Table to Diagram",
      description: "Add a database table (with columns) to an existing diagram's erDiagram mermaid code",
      inputSchema: {
        id: z.string().describe("The diagram ID"),
        tableName: z.string().describe("Name of the table"),
        columns: z.array(
          z.object({
            name: z.string().describe("Column name"),
            type: z.string().describe("Column type (e.g. 'int', 'varchar', 'timestamp')"),
            constraint: z.enum(["primary", "foreign", "unique", "nullable"]).optional().describe("Column constraint"),
          })
        ),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ id, tableName, columns }: {
      id: string;
      tableName: string;
      columns: Array<{ name: string; type: string; constraint?: "primary" | "foreign" | "unique" | "nullable" }>;
    }) => {
      const persisted = dbSaveDiagram(appendErTable(requireDiagram(id), { name: tableName, columns }));
      return { message: `Table '${tableName}' added`, mermaidCode: persisted.mermaidCode, revision: persisted.revision };
    }
  );

  registerJsonTool(
    server,
    "add_relationship_to_diagram",
    {
      title: "Add Relationship to Diagram",
      description: "Add a relationship between two tables in an existing diagram's erDiagram",
      inputSchema: {
        id: z.string().describe("The diagram ID"),
        from: z.string().describe("Source table name"),
        to: z.string().describe("Target table name"),
        label: z.string().describe("Relationship label (e.g. 'has many', 'belongs to')"),
        cardinality: z.enum(["one-to-one", "one-to-many", "many-to-many"]).optional().default("one-to-many").describe("Relationship cardinality"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ id, from, to, label, cardinality }: {
      id: string;
      from: string;
      to: string;
      label: string;
      cardinality?: "one-to-one" | "one-to-many" | "many-to-many";
    }) => {
      const persisted = dbSaveDiagram(appendErRelationship(requireDiagram(id), { from, to, label, cardinality }));
      return { message: `Relationship ${from} -> ${to} added`, mermaidCode: persisted.mermaidCode, revision: persisted.revision };
    }
  );
}
