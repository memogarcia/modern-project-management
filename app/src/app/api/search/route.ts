import { NextResponse } from "next/server";
import { searchTroubleshootingMemory } from "@/lib/db.server";
import { withApiErrorHandling } from "@/lib/api";
import { searchQuerySchema } from "@planview/validation";

export async function GET(request: Request) {
  return withApiErrorHandling(async () => {
    const { searchParams } = new URL(request.url);
    const query = searchQuerySchema.parse({
      q: searchParams.get("q") ?? "",
      diagramId: searchParams.get("diagramId") ?? undefined,
      nodeId: searchParams.get("nodeId") ?? undefined,
      edgeId: searchParams.get("edgeId") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    const results = searchTroubleshootingMemory(query);
    return NextResponse.json(results);
  });
}
