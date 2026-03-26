import { deleteProjectTask } from "@/lib/db.server";
import { jsonRoute, parseRouteParams } from "@/lib/api";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  return jsonRoute(async () => {
    const { id, taskId } = await parseRouteParams(params, [
      { key: "id", label: "project id" },
      { key: "taskId", label: "task id" },
    ]);
    deleteProjectTask(id, taskId);
    return { ok: true };
  });
}
