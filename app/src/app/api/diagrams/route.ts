import { jsonRoute, parseJsonBody } from "@/lib/api";
import { listDiagrams, upsertDiagram } from "@/lib/db.server";
import { diagramUpsertSchema } from "@planview/validation";

/** GET /api/diagrams — list all diagrams */
export async function GET() {
  return jsonRoute(async () => listDiagrams());
}

/** POST /api/diagrams — create or update a diagram */
export async function POST(req: Request) {
  return jsonRoute(async () => {
    const body = await parseJsonBody(req, diagramUpsertSchema);
    return upsertDiagram({
      ...body,
      projectId: body.projectId ?? null,
      nodes: body.nodes as never[],
      edges: body.edges as never[],
    } as never);
  });
}
