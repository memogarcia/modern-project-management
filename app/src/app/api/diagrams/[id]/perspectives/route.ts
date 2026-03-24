import { listDiagramPerspectives, upsertDiagramPerspective } from "@/lib/db.server";
import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { diagramPerspectiveSchema } from "@planview/validation";

/** GET /api/diagrams/:id/perspectives — list saved perspectives for a diagram */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "diagram id" }]);
    return listDiagramPerspectives(id);
  });
}

/** POST /api/diagrams/:id/perspectives — create or update a saved perspective */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "diagram id" }]);
    const body = await parseJsonBody(request, diagramPerspectiveSchema);
    return upsertDiagramPerspective(id, body);
  });
}
