import { NextResponse } from "next/server";
import { appendSessionCommand } from "@/lib/db.server";
import { jsonErrorResponse, parseJsonBody } from "@/lib/api";
import { SAFE_ENTITY_ID_RE, sessionCommandSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!SAFE_ENTITY_ID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid investigation id" }, { status: 400 });
    }
    const body = await parseJsonBody(request, sessionCommandSchema);
    const command = appendSessionCommand(id, body);
    return NextResponse.json(command, { status: 201 });
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

