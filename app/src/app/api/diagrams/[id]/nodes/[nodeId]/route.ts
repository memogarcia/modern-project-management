import { NextResponse } from "next/server";
import { parseJsonBody, jsonErrorResponse } from "@/lib/api";
import { updateDiagramNodeDetails } from "@/lib/db.server";
import { diagramNodeMetadataPatchSchema, SAFE_ENTITY_ID_RE } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { id, nodeId } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id) || !SAFE_ENTITY_ID_RE.test(nodeId)) {
      return NextResponse.json({ error: "Invalid diagram or node id" }, { status: 400 });
    }

    const body = await parseJsonBody(request, diagramNodeMetadataPatchSchema);
    const updated = updateDiagramNodeDetails(id, nodeId, body.metadata, body.expectedRevision);
    return NextResponse.json(updated);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

