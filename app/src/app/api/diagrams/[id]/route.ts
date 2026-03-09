import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Diagram } from "@/lib/types";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { CorruptJsonFileError, readJsonFile } from "@/lib/jsonFiles.server";

const SAFE_DIAGRAM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeDiagramId(id: string): boolean {
  return SAFE_DIAGRAM_ID_RE.test(id);
}

function filePath(id: string) {
  if (!isSafeDiagramId(id)) return null;
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
  if (!fp) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const diagram = readJsonFile<Diagram>(fp);
    return NextResponse.json(diagram);
  } catch (error) {
    if (error instanceof CorruptJsonFileError) {
      return NextResponse.json({ error: "Corrupt diagram file" }, { status: 500 });
    }
    throw error;
  }
}

/** DELETE /api/diagrams/:id — delete a diagram */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fp) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
  return NextResponse.json({ ok: true });
}
