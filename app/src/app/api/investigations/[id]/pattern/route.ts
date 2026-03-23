import { NextResponse } from "next/server";
import { extractKnowledgePattern, getTroubleshootingSessionById } from "@/lib/db.server";
import { jsonErrorResponse, parseJsonBody } from "@/lib/api";
import { SAFE_ENTITY_ID_RE, patternExtractionSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid investigation id" }, { status: 400 });
    }
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
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
