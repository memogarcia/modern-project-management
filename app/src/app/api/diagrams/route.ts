import { NextResponse } from "next/server";
import type { Diagram } from "@/lib/types";
import { listDiagramsFull, upsertDiagram } from "@/lib/db.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** GET /api/diagrams — list all diagrams */
export async function GET() {
  const diagrams = listDiagramsFull();
  return NextResponse.json(diagrams);
}

/** POST /api/diagrams — create or update a diagram */
export async function POST(req: Request) {
  let diagram: Diagram;
  try {
    diagram = (await req.json()) as Diagram;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!diagram.id) {
    return NextResponse.json({ error: "Missing diagram id" }, { status: 400 });
  }
  if (!SAFE_ID_RE.test(diagram.id)) {
    return NextResponse.json({ error: "Invalid diagram id" }, { status: 400 });
  }

  upsertDiagram(diagram);
  return NextResponse.json({ ok: true, id: diagram.id });
}
