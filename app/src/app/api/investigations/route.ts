import { NextResponse } from "next/server";
import { createTroubleshootingSession, listTroubleshootingSessions } from "@/lib/db.server";
import { parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { troubleshootingSessionCreateSchema } from "@planview/validation";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const sessions = listTroubleshootingSessions({
      diagramId: searchParams.get("diagramId") ?? undefined,
      nodeId: searchParams.get("nodeId") ?? undefined,
      edgeId: searchParams.get("edgeId") ?? undefined,
      q: searchParams.get("q") ?? undefined,
    });
    return NextResponse.json(sessions);
  });
}

export async function POST(request: Request) {
  return withApiErrorHandling(async () => {
    const body = await parseJsonBody(request, troubleshootingSessionCreateSchema);
    const session = createTroubleshootingSession({
      id: body.id,
      diagramId: body.diagramId,
      projectId: body.projectId ?? null,
      systemScope: body.systemScope,
      title: body.title,
      summary: body.summary,
      status: body.status,
      linkedNodeIds: body.linkedNodeIds,
      linkedEdgeIds: body.linkedEdgeIds,
      timelineEntries: [],
      notesMarkdown: body.notesMarkdown,
      hypotheses: body.hypotheses,
      commands: [],
      aiTranscriptReferences: body.aiTranscriptReferences,
      artifacts: [],
      comments: [],
      resolutionSummary: body.resolutionSummary,
      createdAt: body.createdAt ?? new Date().toISOString(),
      updatedAt: body.updatedAt ?? new Date().toISOString(),
    } as never);
    return NextResponse.json(session, { status: 201 });
  });
}
