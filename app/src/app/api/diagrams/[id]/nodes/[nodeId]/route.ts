import { NextResponse } from "next/server";
import { assertSafeEntityIds, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { updateDiagramNodeDetails } from "@/lib/db.server";
import { diagramNodeMetadataPatchSchema } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id, nodeId } = await params;
    assertSafeEntityIds([
      { id, label: "diagram id" },
      { id: nodeId, label: "node id" },
    ]);

    const body = await parseJsonBody(request, diagramNodeMetadataPatchSchema);
    const updated = updateDiagramNodeDetails(id, nodeId, body.metadata, body.expectedRevision);
    return NextResponse.json(updated);
  });
}
