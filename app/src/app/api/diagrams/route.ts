import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { Diagram } from "@/lib/types";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";

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
  const files = fs
    .readdirSync(DIAGRAMS_DIR)
    .filter((f) => f.endsWith(".json"));

  const diagrams: Diagram[] = files.map((f) => {
    const raw = fs.readFileSync(path.join(DIAGRAMS_DIR, f), "utf-8");
    return JSON.parse(raw) as Diagram;
  });

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
  const diagram = (await req.json()) as Diagram;

  if (!diagram.id) {
    return NextResponse.json({ error: "Missing diagram id" }, { status: 400 });
  }
  if (!isSafeDiagramId(diagram.id)) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }

  const filePath = path.join(DIAGRAMS_DIR, `${diagram.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(diagram, null, 2), "utf-8");
  return NextResponse.json({ ok: true, id: diagram.id });
}
