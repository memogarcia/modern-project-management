import { NextResponse } from "next/server";
import { parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { listDiagrams, upsertDiagram } from "@/lib/db.server";
import { diagramUpsertSchema } from "@planview/validation";

/** GET /api/diagrams — list all diagrams */
export async function GET() {
  return withApiErrorHandling(async () => NextResponse.json(listDiagrams()));
}

/** POST /api/diagrams — create or update a diagram */
export async function POST(req: Request) {
  return withApiErrorHandling(async () => {
    const body = await parseJsonBody(req, diagramUpsertSchema);
    const saved = upsertDiagram({
      ...body,
      projectId: body.projectId ?? null,
      nodes: body.nodes as never[],
      edges: body.edges as never[],
    } as never);
    return NextResponse.json(saved);
  });
}
