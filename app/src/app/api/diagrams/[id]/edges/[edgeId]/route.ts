import { NextResponse } from "next/server";
import { parseJsonBody, jsonErrorResponse } from "@/lib/api";
import { updateDiagramEdgeDetails } from "@/lib/db.server";
import { diagramEdgeMetadataPatchSchema, SAFE_ENTITY_ID_RE } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  try {
    const { id, edgeId } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id) || !SAFE_ENTITY_ID_RE.test(edgeId)) {
      return NextResponse.json({ error: "Invalid diagram or edge id" }, { status: 400 });
    }

    const body = await parseJsonBody(request, diagramEdgeMetadataPatchSchema);
    const updated = updateDiagramEdgeDetails(id, edgeId, body.metadata, body.expectedRevision);
    return NextResponse.json(updated);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

