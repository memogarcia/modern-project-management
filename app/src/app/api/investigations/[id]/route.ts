import { NextResponse } from "next/server";
import { getTroubleshootingSessionById, updateTroubleshootingSession } from "@/lib/db.server";
import { jsonErrorResponse, parseJsonBody } from "@/lib/api";
import { SAFE_ENTITY_ID_RE, troubleshootingSessionPatchSchema } from "@planview/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid investigation id" }, { status: 400 });
    }

    const session = getTroubleshootingSessionById(id);
    if (!session) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid investigation id" }, { status: 400 });
    }

    const body = await parseJsonBody(request, troubleshootingSessionPatchSchema);
    const updated = updateTroubleshootingSession(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

