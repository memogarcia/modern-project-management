import { NextResponse } from "next/server";
import { assertSafeEntityIds, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { updateDiagramEdgeDetails } from "@/lib/db.server";
import { diagramEdgeMetadataPatchSchema } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id, edgeId } = await params;
    assertSafeEntityIds([
      { id, label: "diagram id" },
      { id: edgeId, label: "edge id" },
    ]);

    const body = await parseJsonBody(request, diagramEdgeMetadataPatchSchema);
    const updated = updateDiagramEdgeDetails(id, edgeId, body.metadata, body.expectedRevision);
    return NextResponse.json(updated);
  });
}
