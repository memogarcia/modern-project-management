import { listKnowledgePatterns } from "@/lib/db.server";
import { jsonRoute } from "@/lib/api";

export async function GET() {
  return jsonRoute(async () => listKnowledgePatterns());
}
