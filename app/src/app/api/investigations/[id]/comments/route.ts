import { appendSessionComment } from "@/lib/db.server";
import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { sessionCommentSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);
    const body = await parseJsonBody(request, sessionCommentSchema);
    return appendSessionComment(id, body);
  }, { status: 201 });
}
