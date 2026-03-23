import { NextResponse } from "next/server";
import { appendSessionCommand } from "@/lib/db.server";
import { assertSafeEntityId, parseJsonBody, withApiErrorHandling } from "@/lib/api";
import { sessionCommandSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withApiErrorHandling(async () => {
    const { id } = await params;
    assertSafeEntityId(id, "investigation id");
    const body = await parseJsonBody(request, sessionCommandSchema);
    const command = appendSessionCommand(id, body);
    return NextResponse.json(command, { status: 201 });
  });
}
