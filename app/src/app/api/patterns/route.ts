import { NextResponse } from "next/server";
import { listKnowledgePatterns } from "@/lib/db.server";
import { jsonErrorResponse } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json(listKnowledgePatterns());
  } catch (error) {
    return jsonErrorResponse(error);
  }
}

