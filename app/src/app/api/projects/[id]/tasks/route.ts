import { listProjectTasks, upsertProjectTask } from "@/lib/db.server";
import { jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { projectTaskUpsertSchema } from "@planview/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "project id" }]);
    return listProjectTasks(id);
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "project id" }]);
    const body = await parseJsonBody(request, projectTaskUpsertSchema);
    return upsertProjectTask(id, body);
  });
}
