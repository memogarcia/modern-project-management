import { appendSessionCommand } from "@/lib/db.server";
import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { sessionCommandSchema } from "@planview/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);
    const body = await parseJsonBody(request, sessionCommandSchema);
    return appendSessionCommand(id, body);
  }, { status: 201 });
}
