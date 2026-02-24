import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Diagram } from "@/lib/types";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";

function filePath(id: string) {
  const dir = ensureDiagramsDir();
  return path.join(dir, `${id}.json`);
}

/** GET /api/diagrams/:id — get a single diagram */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const diagram = JSON.parse(fs.readFileSync(fp, "utf-8")) as Diagram;
  return NextResponse.json(diagram);
}

/** DELETE /api/diagrams/:id — delete a diagram */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
  return NextResponse.json({ ok: true });
}
