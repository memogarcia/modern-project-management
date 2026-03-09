import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Diagram } from "@/lib/types";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { listJsonFilesSafe, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

const SAFE_DIAGRAM_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeDiagramId(id: unknown): id is string {
  return typeof id === "string" && SAFE_DIAGRAM_ID_RE.test(id);
}

/**
 * Shared diagrams-data directory — same location the MCP server uses.
 * Both the Next.js app and the MCP server read/write JSON files here,
 * so diagrams created from either side are immediately visible everywhere.
 */
function diagramsDir(): string {
  return ensureDiagramsDir();
}

/** GET /api/diagrams — list all diagrams */
export async function GET() {
  const DIAGRAMS_DIR = diagramsDir();
  const diagrams = listJsonFilesSafe<Diagram>(DIAGRAMS_DIR);

  // Sort newest first
  diagrams.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json(diagrams);
}

/** POST /api/diagrams — create or update a diagram */
export async function POST(req: Request) {
  const DIAGRAMS_DIR = diagramsDir();
  let diagram: Diagram;
  try {
    diagram = (await req.json()) as Diagram;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!diagram.id) {
    return NextResponse.json({ error: "Missing diagram id" }, { status: 400 });
  }
  if (!isSafeDiagramId(diagram.id)) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }

  const filePath = path.join(DIAGRAMS_DIR, `${diagram.id}.json`);
  writeJsonFileAtomic(filePath, diagram);
  return NextResponse.json({ ok: true, id: diagram.id });
}
