import { searchTroubleshootingMemory } from "@/lib/db.server";
import { jsonRoute } from "@/lib/api";
import { parseTroubleshootingMemoryQuery } from "@/lib/investigationQueries";

export async function GET(request: Request) {
  return jsonRoute(async () => {
    return searchTroubleshootingMemory(parseTroubleshootingMemoryQuery(request));
  });
}
