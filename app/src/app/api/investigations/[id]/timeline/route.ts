import { appendSessionTimelineEntry } from "@/lib/db.server";
import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { timelineEntrySchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);
    const body = await parseJsonBody(request, timelineEntrySchema);
    return appendSessionTimelineEntry(id, body);
  }, { status: 201 });
}
