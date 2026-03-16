import { NextResponse } from "next/server";
import { getProjectById, deleteProject } from "@/lib/db.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** GET /api/projects/:id */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!SAFE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const project = getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(project);
}

/** DELETE /api/projects/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!SAFE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  deleteProject(id);
  return NextResponse.json({ ok: true });
}
