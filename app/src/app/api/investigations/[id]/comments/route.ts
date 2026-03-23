import { NextResponse } from "next/server";
import { appendSessionComment } from "@/lib/db.server";
import { assertSafeEntityId, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { sessionCommentSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");
    const body = await parseJsonBody(request, sessionCommentSchema);
    const comment = appendSessionComment(id, body);
    return NextResponse.json(comment, { status: 201 });
  });
}
