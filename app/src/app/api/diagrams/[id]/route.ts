import { NextResponse } from "next/server";
import { getDiagramById, deleteDiagram } from "@/lib/db.server";
import { assertSafeEntityId, withApiErrorHandling } from "@/lib/api";

/** GET /api/diagrams/:id — get a single diagram */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "diagram id");
    const diagram = getDiagramById(id);
    if (!diagram) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(diagram);
  });
}

/** DELETE /api/diagrams/:id — delete a diagram */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "diagram id");
    deleteDiagram(id);
    return NextResponse.json({ ok: true });
  });
}
