import { deleteDiagramPerspective } from "@/lib/db.server";
import { jsonRoute, parseRouteParams } from "@/lib/api";

/** DELETE /api/diagrams/:id/perspectives/:perspectiveId — delete a saved perspective */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; perspectiveId: string }> }
) {
  return jsonRoute(async () => {
    const { id, perspectiveId } = await parseRouteParams(params, [
      { key: "id", label: "diagram id" },
      { key: "perspectiveId", label: "perspective id" },
    ]);
    deleteDiagramPerspective(id, perspectiveId);
    return { ok: true };
  });
}
