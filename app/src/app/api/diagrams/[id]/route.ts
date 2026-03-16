import { NextResponse } from "next/server";
import { getDiagramById, deleteDiagram } from "@/lib/db.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** GET /api/diagrams/:id — get a single diagram */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!SAFE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }
  const diagram = getDiagramById(id);
  if (!diagram) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(diagram);
}

/** DELETE /api/diagrams/:id — delete a diagram */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!SAFE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }
  deleteDiagram(id);
  return NextResponse.json({ ok: true });
}
