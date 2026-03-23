import { NextResponse } from "next/server";
import { getTroubleshootingSessionById, updateTroubleshootingSession } from "@/lib/db.server";
import { assertSafeEntityId, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { troubleshootingSessionPatchSchema } from "@planview/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");

    const session = getTroubleshootingSessionById(id);
    if (!session) {
      return NextResponse.json({ error: "Investigation not found" }, { status: 404 });
    }
    return NextResponse.json(session);
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");

    const body = await parseJsonBody(request, troubleshootingSessionPatchSchema);
    const updated = updateTroubleshootingSession(id, body);
    return NextResponse.json(updated);
  });
}
