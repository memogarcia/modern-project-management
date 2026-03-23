import { NextResponse } from "next/server";
import { extractKnowledgePattern, getTroubleshootingSessionById } from "@/lib/db.server";
import { assertSafeEntityId, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { patternExtractionSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");
    const session = getTroubleshootingSessionById(id);
    if (!session) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }
    const body = await parseJsonBody(request, patternExtractionSchema);
    const pattern = extractKnowledgePattern(id, {
      title: body.title,
      summary: body.summary,
      symptom: body.symptom,
      resolution: body.resolution,
      tags: body.tags,
      linkedNodeIds: session.linkedNodeIds,
      linkedEdgeIds: session.linkedEdgeIds,
    });
    return NextResponse.json(pattern, { status: 201 });
  });
}
