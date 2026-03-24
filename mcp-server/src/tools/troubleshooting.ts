import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  appendSessionCommand as dbAppendSessionCommand,
  appendSessionComment as dbAppendSessionComment,
  appendSessionTimelineEntry as dbAppendTimelineEntry,
  createTroubleshootingSession as dbCreateTroubleshootingSession,
  extractKnowledgePattern as dbExtractKnowledgePattern,
  getTroubleshootingSessionById as dbGetTroubleshootingSession,
  listKnowledgePatterns as dbListKnowledgePatterns,
  listTroubleshootingSessions as dbListTroubleshootingSessions,
  searchTroubleshootingMemory as dbSearchTroubleshootingMemory,
  updateTroubleshootingSession as dbUpdateTroubleshootingSession,
} from "../db.js";
import { createTroubleshootingSessionDraft } from "../../../shared/planview/application.js";
import { toTroubleshootingSessionResourceSummary } from "../../../shared/planview/projections.js";
import {
  patternExtractionSchema,
  sessionCommandSchema,
  sessionCommentSchema,
  timelineEntrySchema,
  troubleshootingSessionCreateSchema,
  troubleshootingSessionPatchSchema,
} from "../../../shared/planview/validation.js";
import { assertFound, registerJsonTool } from "../toolkit.js";

function requireTroubleshootingSession(id: string) {
  return assertFound(
    dbGetTroubleshootingSession(id),
    "session_not_found",
    `Troubleshooting session not found: ${id}`
  );
}

export function registerTroubleshootingTools(server: McpServer): void {
  registerJsonTool(
    server,
    "create_troubleshooting_session",
    {
      title: "Create Troubleshooting Session",
      description:
        "Create a new investigation linked to a diagram and affected graph entities. Use node IDs and edge IDs discovered from `get_diagram_metadata`.",
      inputSchema: troubleshootingSessionCreateSchema.shape,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (args: z.infer<typeof troubleshootingSessionCreateSchema>) => {
      const input = troubleshootingSessionCreateSchema.parse(args);
      return dbCreateTroubleshootingSession(
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
    },
    { fallbackCode: "session_create_failed", fallbackMessage: "Failed to create troubleshooting session" }
  );

  registerJsonTool(
    server,
    "list_troubleshooting_sessions",
    {
      title: "List Troubleshooting Sessions",
      description:
        "List troubleshooting sessions filtered by diagram, node, edge, or search term so you can find related historical investigations before creating a new one.",
      inputSchema: {
        diagramId: z.string().optional(),
        nodeId: z.string().optional(),
        edgeId: z.string().optional(),
        q: z.string().optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ diagramId, nodeId, edgeId, q }: { diagramId?: string; nodeId?: string; edgeId?: string; q?: string }) =>
      dbListTroubleshootingSessions({ diagramId, nodeId, edgeId, q })
  );

  registerJsonTool(
    server,
    "get_troubleshooting_session",
    {
      title: "Get Troubleshooting Session",
      description: "Get a full troubleshooting session, including timeline, comments, commands, artifacts, and linked entities.",
      inputSchema: { id: z.string().describe("The troubleshooting session ID") },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ id }: { id: string }) => requireTroubleshootingSession(id)
  );

  registerJsonTool(
    server,
    "update_troubleshooting_session",
    {
      title: "Update Troubleshooting Session",
      description:
        "Update the durable summary state of a troubleshooting session, including status, notes, hypotheses, linked entities, or final resolution.",
      inputSchema: {
        id: z.string(),
        ...troubleshootingSessionPatchSchema.shape,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ id, ...patch }: { id: string } & z.infer<typeof troubleshootingSessionPatchSchema>) =>
      dbUpdateTroubleshootingSession(id, troubleshootingSessionPatchSchema.parse(patch)),
    { fallbackCode: "session_update_failed", fallbackMessage: "Failed to update troubleshooting session" }
  );

  registerJsonTool(
    server,
    "append_session_timeline_entry",
    {
      title: "Append Session Timeline Entry",
      description:
        "Append a chronological timeline entry to a troubleshooting session. Use this for observations, hypotheses, commands, status changes, and resolutions.",
      inputSchema: {
        sessionId: z.string(),
        entry: timelineEntrySchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ sessionId, entry }: { sessionId: string; entry: z.input<typeof timelineEntrySchema> }) =>
      dbAppendTimelineEntry(sessionId, timelineEntrySchema.parse(entry)),
    { fallbackCode: "timeline_append_failed", fallbackMessage: "Failed to append timeline entry" }
  );

  registerJsonTool(
    server,
    "append_session_comment",
    {
      title: "Append Session Comment",
      description: "Append a short comment or note to a troubleshooting session.",
      inputSchema: {
        sessionId: z.string(),
        comment: sessionCommentSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ sessionId, comment }: { sessionId: string; comment: z.input<typeof sessionCommentSchema> }) =>
      dbAppendSessionComment(sessionId, sessionCommentSchema.parse(comment)),
    { fallbackCode: "comment_append_failed", fallbackMessage: "Failed to append session comment" }
  );

  registerJsonTool(
    server,
    "append_session_command",
    {
      title: "Append Session Command",
      description:
        "Append a command record to a troubleshooting session, including the command text, a short summary, and the important output excerpt.",
      inputSchema: {
        sessionId: z.string(),
        command: sessionCommandSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ sessionId, command }: { sessionId: string; command: z.input<typeof sessionCommandSchema> }) =>
      dbAppendSessionCommand(sessionId, sessionCommandSchema.parse(command)),
    { fallbackCode: "command_append_failed", fallbackMessage: "Failed to append session command" }
  );

  registerJsonTool(
    server,
    "link_session_to_entities",
    {
      title: "Link Session To Entities",
      description:
        "Replace the set of linked nodes and edges for a troubleshooting session. Use exact node IDs and edge IDs from `get_diagram_metadata`.",
      inputSchema: {
        sessionId: z.string(),
        linkedNodeIds: z.array(z.string()).default([]),
        linkedEdgeIds: z.array(z.string()).default([]),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ sessionId, linkedNodeIds, linkedEdgeIds }: {
      sessionId: string;
      linkedNodeIds: string[];
      linkedEdgeIds: string[];
    }) => dbUpdateTroubleshootingSession(sessionId, { linkedNodeIds, linkedEdgeIds }),
    { fallbackCode: "session_link_failed", fallbackMessage: "Failed to link session entities" }
  );

  registerJsonTool(
    server,
    "extract_knowledge_pattern",
    {
      title: "Extract Knowledge Pattern",
      description:
        "Extract a reusable troubleshooting pattern from a resolved troubleshooting session. Use this when the symptom and fix are now durable enough to reuse later.",
      inputSchema: {
        sessionId: z.string(),
        pattern: patternExtractionSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ sessionId, pattern }: { sessionId: string; pattern: z.input<typeof patternExtractionSchema> }) => {
      const session = requireTroubleshootingSession(sessionId);
      const input = patternExtractionSchema.parse(pattern);
      const sessionSummary = toTroubleshootingSessionResourceSummary(session);
      return dbExtractKnowledgePattern(sessionId, {
        title: input.title,
        summary: input.summary,
        symptom: input.symptom,
        resolution: input.resolution,
        tags: input.tags,
        linkedNodeIds: sessionSummary.linkedNodeIds,
        linkedEdgeIds: sessionSummary.linkedEdgeIds,
      });
    },
    { fallbackCode: "pattern_extract_failed", fallbackMessage: "Failed to extract knowledge pattern" }
  );

  registerJsonTool(
    server,
    "search_troubleshooting_memory",
    {
      title: "Search Troubleshooting Memory",
      description:
        "Search troubleshooting sessions and reusable patterns by text and affected graph entities before opening a new investigation or while looking for similar fixes.",
      inputSchema: {
        q: z.string(),
        diagramId: z.string().optional(),
        nodeId: z.string().optional(),
        edgeId: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    ({ q, diagramId, nodeId, edgeId, limit }: {
      q: string;
      diagramId?: string;
      nodeId?: string;
      edgeId?: string;
      limit?: number;
    }) => dbSearchTroubleshootingMemory({ q, diagramId, nodeId, edgeId, limit })
  );

  registerJsonTool(
    server,
    "list_knowledge_patterns",
    {
      title: "List Knowledge Patterns",
      description: "List extracted reusable troubleshooting patterns.",
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    () => dbListKnowledgePatterns()
  );
}
