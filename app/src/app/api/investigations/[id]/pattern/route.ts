import { extractKnowledgePattern, getTroubleshootingSessionById } from "@/lib/db.server";
import { jsonNotFound, jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { patternExtractionSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);
    const session = getTroubleshootingSessionById(id);
    if (!session) {
      return jsonNotFound("Investigation not found");
    }
    const body = await parseJsonBody(request, patternExtractionSchema);
    return extractKnowledgePattern(id, {
      title: body.title,
      summary: body.summary,
      symptom: body.symptom,
      resolution: body.resolution,
      tags: body.tags,
      linkedNodeIds: session.linkedNodeIds,
      linkedEdgeIds: session.linkedEdgeIds,
    });
  }, { status: 201 });
}
