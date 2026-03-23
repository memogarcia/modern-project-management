import { getDiagramById, deleteDiagram } from "@/lib/db.server";
import { jsonNotFound, jsonRoute, parseRouteParams } from "@/lib/api";

/** GET /api/diagrams/:id — get a single diagram */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "diagram id" }]);
    const diagram = getDiagramById(id);
    if (!diagram) {
      return jsonNotFound("Not found");
    }
    return diagram;
  });
}

/** DELETE /api/diagrams/:id — delete a diagram */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "diagram id" }]);
    deleteDiagram(id);
    return { ok: true };
  });
}
