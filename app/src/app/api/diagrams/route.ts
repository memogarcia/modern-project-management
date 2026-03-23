import { NextResponse } from "next/server";
import { parseJsonBody, jsonErrorResponse } from "@/lib/api";
import { listDiagrams, upsertDiagram } from "@/lib/db.server";
import { diagramUpsertSchema } from "@planview/validation";

/** GET /api/diagrams — list all diagrams */
export async function GET() {
  return NextResponse.json(listDiagrams());
}

/** POST /api/diagrams — create or update a diagram */
export async function POST(req: Request) {
  try {
    const body = await parseJsonBody(req, diagramUpsertSchema);
    const saved = upsertDiagram({
      id: body.id,
      projectId: body.projectId ?? null,
      name: body.name,
      description: body.description,
      mermaidCode: body.mermaidCode,
      nodes: body.nodes as never[],
      edges: body.edges as never[],
      createdAt: body.createdAt,
      updatedAt: body.updatedAt ?? new Date().toISOString(),
      revision: body.revision,
      expectedRevision: body.expectedRevision,
    } as never);
    return NextResponse.json(saved);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}
