import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { updateDiagramEdgeDetails } from "@/lib/db.server";
import { diagramEdgeMetadataPatchSchema } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; edgeId: string }> }
) {
  return jsonRoute(async () => {
    const { id, edgeId } = await parseRouteParams(params, [
      { key: "id", label: "diagram id" },
      { key: "edgeId", label: "edge id" },
    ]);
    const body = await parseJsonBody(request, diagramEdgeMetadataPatchSchema);
    return updateDiagramEdgeDetails(id, edgeId, body.metadata, body.expectedRevision);
  });
}
