import { NextResponse } from "next/server";
import { listKnowledgePatterns } from "@/lib/db.server";
import { withApiErrorHandling } from "@/lib/api";

export async function GET() {
  return withApiErrorHandling(async () => {
    return NextResponse.json(listKnowledgePatterns());
  });
}
