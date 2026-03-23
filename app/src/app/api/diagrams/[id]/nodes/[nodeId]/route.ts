import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { updateDiagramNodeDetails } from "@/lib/db.server";
import { diagramNodeMetadataPatchSchema } from "@planview/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  return jsonRoute(async () => {
    const { id, nodeId } = await parseRouteParams(params, [
      { key: "id", label: "diagram id" },
      { key: "nodeId", label: "node id" },
    ]);
    const body = await parseJsonBody(request, diagramNodeMetadataPatchSchema);
    return updateDiagramNodeDetails(id, nodeId, body.metadata, body.expectedRevision);
  });
}
