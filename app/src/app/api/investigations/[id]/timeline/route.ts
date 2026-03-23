import { NextResponse } from "next/server";
import { appendSessionTimelineEntry } from "@/lib/db.server";
import { assertSafeEntityId, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { timelineEntrySchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");
    const body = await parseJsonBody(request, timelineEntrySchema);
    const entry = appendSessionTimelineEntry(id, body);
    return NextResponse.json(entry, { status: 201 });
  });
}
