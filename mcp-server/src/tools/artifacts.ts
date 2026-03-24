import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getArtifactById as dbGetArtifactById,
  listArtifacts as dbListArtifacts,
  saveArtifactFile as dbSaveArtifactFile,
} from "../db.js";
import { toArtifactResourceSummary } from "../../../shared/planview/projections.js";
import { abortTool, assertFound, registerJsonTool } from "../toolkit.js";

function requireArtifact(id: string) {
  return assertFound(dbGetArtifactById(id), "artifact_not_found", `Artifact not found: ${id}`);
}

export function registerArtifactTools(server: McpServer): void {
  registerJsonTool(
    server,
    "list_artifacts",
    {
      title: "List Artifacts",
      description:
        "List stored evidence artifacts by owner, diagram, or label so you can discover artifact IDs and existing attachments.",
      inputSchema: {
        ownerType: z.enum(["node", "edge", "session"]).optional(),
        ownerId: z.string().optional(),
        diagramId: z.string().optional(),
        q: z.string().optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ ownerType, ownerId, diagramId, q, limit }: {
      ownerType?: "node" | "edge" | "session";
      ownerId?: string;
      diagramId?: string;
      q?: string;
      limit?: number;
    }) => dbListArtifacts({ ownerType, ownerId, diagramId, q, limit })
  );

  registerJsonTool(
    server,
    "get_artifact_metadata",
    {
      title: "Get Artifact Metadata",
      description: "Get metadata for a single evidence artifact, including ownership and storage details.",
      inputSchema: {
        artifactId: z.string().describe("Artifact ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ artifactId }: { artifactId: string }) => toArtifactResourceSummary(requireArtifact(artifactId)),
    { fallbackCode: "artifact_read_failed", fallbackMessage: "Failed to load artifact metadata" }
  );

  registerJsonTool(
    server,
    "attach_artifact",
    {
      title: "Attach Artifact",
      description:
        "Store a text or binary artifact against a troubleshooting session, node, or edge. Pass raw bytes as base64 in `contentBase64`. If you also want the artifact listed inside node metadata attachments, copy the returned artifact reference into a later metadata update.",
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
    },
    async ({ ownerType, ownerId, diagramId, label, fileName, mimeType, contentBase64 }: {
      ownerType: "node" | "edge" | "session";
      ownerId: string;
      diagramId?: string;
      label?: string;
      fileName: string;
      mimeType?: string;
      contentBase64: string;
    }) => {
      const bytes = Buffer.from(contentBase64, "base64");
      if (bytes.byteLength === 0) {
        abortTool("artifact_empty", "Artifact content must not be empty.");
      }
      return dbSaveArtifactFile({
        ownerType,
        ownerId,
        diagramId,
        label,
        fileName,
        mimeType: mimeType ?? "application/octet-stream",
        bytes,
      });
    },
    { fallbackCode: "artifact_attach_failed", fallbackMessage: "Failed to attach artifact" }
  );
}
