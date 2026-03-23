import { NextResponse } from "next/server";
import { searchTroubleshootingMemory } from "@/lib/db.server";
import { jsonErrorResponse } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ error: "Missing q query parameter" }, { status: 400 });
    }
    const results = searchTroubleshootingMemory({
      q,
      diagramId: searchParams.get("diagramId") ?? undefined,
      nodeId: searchParams.get("nodeId") ?? undefined,
      edgeId: searchParams.get("edgeId") ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return NextResponse.json(results);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

