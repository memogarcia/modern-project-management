import { createTroubleshootingSession, listTroubleshootingSessions } from "@/lib/db.server";
import { parseInvestigationListQuery } from "@/lib/investigationQueries";
import { jsonRoute, parseJsonBody } from "@/lib/api";
import { createEmptyTroubleshootingSession } from "@planview/domain";
import { troubleshootingSessionCreateSchema } from "@planview/validation";

export async function GET(request: Request) {
  return jsonRoute(async () => listTroubleshootingSessions(parseInvestigationListQuery(request)));
}

export async function POST(request: Request) {
  return jsonRoute(
    async () => {
      const body = await parseJsonBody(request, troubleshootingSessionCreateSchema);
      const now = new Date().toISOString();
      return createTroubleshootingSession({
        ...createEmptyTroubleshootingSession({
          id: body.id,
          diagramId: body.diagramId,
          title: body.title,
          summary: body.summary,
          linkedNodeIds: body.linkedNodeIds,
          linkedEdgeIds: body.linkedEdgeIds,
          projectId: body.projectId ?? null,
          systemScope: body.systemScope,
          status: body.status,
          notesMarkdown: body.notesMarkdown,
          hypotheses: body.hypotheses,
          aiTranscriptReferences: body.aiTranscriptReferences,
          resolutionSummary: body.resolutionSummary,
          createdAt: body.createdAt ?? now,
          updatedAt: body.updatedAt ?? now,
        }),
      });
    },
    { status: 201 }
  );
}
