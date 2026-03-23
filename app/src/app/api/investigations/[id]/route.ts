import { getTroubleshootingSessionById, updateTroubleshootingSession } from "@/lib/db.server";
import { jsonNotFound, jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { troubleshootingSessionPatchSchema } from "@planview/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);

    const session = getTroubleshootingSessionById(id);
    if (!session) {
      return jsonNotFound("Investigation not found");
    }
    return session;
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "investigation id" }]);

    const body = await parseJsonBody(request, troubleshootingSessionPatchSchema);
    return updateTroubleshootingSession(id, body);
  });
}
