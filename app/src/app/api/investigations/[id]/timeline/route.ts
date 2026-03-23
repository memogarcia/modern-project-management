import { NextResponse } from "next/server";
import { appendSessionTimelineEntry } from "@/lib/db.server";
import { jsonErrorResponse, parseJsonBody } from "@/lib/api";
import { SAFE_ENTITY_ID_RE, timelineEntrySchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid investigation id" }, { status: 400 });
    }
    const body = await parseJsonBody(request, timelineEntrySchema);
    const entry = appendSessionTimelineEntry(id, body);
    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

