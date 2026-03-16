import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { KanbanProject } from "@/lib/projectTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { CorruptJsonFileError, readJsonFile } from "@/lib/jsonFiles.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeId(id: string): boolean {
  return SAFE_ID_RE.test(id);
}

function filePath(id: string): string | null {
  if (!isSafeId(id)) return null;
  const base = ensureDiagramsDir();
  const dir = path.join(base, "projects");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, `${id}.json`);
}

/** GET /api/projects/:id */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fp) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (!fs.existsSync(fp)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const project = readJsonFile<KanbanProject>(fp);
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof CorruptJsonFileError) {
      return NextResponse.json({ error: "Corrupt project file" }, { status: 500 });
    }
    throw error;
  }
}

/** DELETE /api/projects/:id */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fp = filePath(id);
  if (!fp) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  if (fs.existsSync(fp)) {
    fs.unlinkSync(fp);
  }
  return NextResponse.json({ ok: true });
}
