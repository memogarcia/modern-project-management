import { deleteProject, getProjectById, updateProject } from "@/lib/db.server";
import { jsonNotFound, jsonRoute, parseJsonBody, parseRouteParams } from "@/lib/api";
import { projectUpdateSchema } from "@planview/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "project id" }]);
    const project = getProjectById(id);
    return project ?? jsonNotFound("Not found");
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "project id" }]);
    const body = await parseJsonBody(request, projectUpdateSchema);
    return updateProject(id, body);
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return jsonRoute(async () => {
    const { id } = await parseRouteParams(params, [{ key: "id", label: "project id" }]);
    deleteProject(id);
    return { ok: true };
  });
}
