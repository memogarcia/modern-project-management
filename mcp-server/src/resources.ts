import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getArtifactById as dbGetArtifactById,
  getDiagramById as dbGetDiagram,
  getPlanViewKnowledgePatternById as dbGetKnowledgePatternById,
  getTroubleshootingSessionById as dbGetTroubleshootingSession,
  listArtifacts as dbListArtifacts,
  listDiagrams as dbListDiagrams,
  listDiagramPerspectives as dbListDiagramPerspectives,
  listKnowledgePatterns as dbListKnowledgePatterns,
  listTroubleshootingSessions as dbListTroubleshootingSessions,
} from "./db.js";
import {
  toArtifactResourceSummary,
  toDiagramResourceSummary,
  toTroubleshootingSessionResourceSummary,
} from "../../shared/planview/projections.js";
import { buildPlanViewGuide } from "./guide.js";

function jsonContents(uri: URL, payload: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function jsonError(uri: URL, error: string, code?: string) {
  return jsonContents(uri, code ? { error, code } : { error });
}

export function registerResources(server: McpServer): void {
  server.registerResource(
    "guide-workflows",
    "planview://guide/workflows",
    {
      title: "PlanView Workflows",
      description: "How to use the MCP tools to build diagrams, enrich metadata, record investigations, attach evidence, and extract reusable patterns.",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, buildPlanViewGuide())
  );

  server.registerResource(
    "diagrams",
    "planview://diagrams",
    {
      title: "All Diagrams",
      description: "List of all diagrams in the workspace",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, dbListDiagrams().map((diagram) => toDiagramResourceSummary(diagram)))
  );

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
      return jsonContents(uri, diagram ?? { error: "Diagram not found" });
    }
  );

  server.registerResource(
    "diagram-perspectives",
    new ResourceTemplate("planview://diagrams/{diagramId}/perspectives", {
      list: async () => ({
        resources: dbListDiagrams().map((diagram) => ({
          uri: `planview://diagrams/${diagram.id}/perspectives`,
          name: `${diagram.name} perspectives`,
        })),
      }),
    }),
    {
      title: "Diagram Perspectives",
      description: "Saved perspectives for a single diagram",
      mimeType: "application/json",
    },
    async (uri, { diagramId }) => {
      const diagram = dbGetDiagram(String(diagramId));
      if (!diagram) {
        return jsonContents(uri, { error: "Diagram not found" });
      }
      return jsonContents(uri, dbListDiagramPerspectives(String(diagramId)));
    }
  );

  server.registerResource(
    "investigations",
    "planview://investigations",
    {
      title: "All Investigations",
      description: "List of troubleshooting sessions in the workspace",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonContents(
        uri,
        dbListTroubleshootingSessions().map((session) => ({
          ...toTroubleshootingSessionResourceSummary(session),
        }))
      )
  );

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
      return jsonContents(uri, session ?? { error: "Troubleshooting session not found" });
    }
  );

  server.registerResource(
    "patterns",
    "planview://patterns",
    {
      title: "Reusable Patterns",
      description: "Extracted troubleshooting memory patterns",
      mimeType: "application/json",
    },
    async (uri) => jsonContents(uri, dbListKnowledgePatterns())
  );

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
      return jsonContents(uri, pattern ?? { error: "Knowledge pattern not found" });
    }
  );

  server.registerResource(
    "artifacts",
    "planview://artifacts",
    {
      title: "Artifacts",
      description: "Stored evidence artifact metadata",
      mimeType: "application/json",
    },
    async (uri) =>
      jsonContents(
        uri,
        dbListArtifacts({ limit: 200 }).map((artifact) => toArtifactResourceSummary(artifact))
      )
  );

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
        return jsonContents(uri, artifact ? toArtifactResourceSummary(artifact) : { error: "Artifact not found" });
      } catch (error) {
        const planViewError = error as { code?: string; message?: string };
        return jsonError(
          uri,
          planViewError.message ?? "Failed to load artifact metadata",
          planViewError.code ?? "artifact_read_failed"
        );
      }
    }
  );
}
