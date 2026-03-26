import { createProject, listProjects } from "@/lib/db.server";
import { jsonRoute, parseJsonBody } from "@/lib/api";
import { projectCreateSchema } from "@planview/validation";

export async function GET() {
  return jsonRoute(async () => listProjects());
}

export async function POST(request: Request) {
  return jsonRoute(
    async () => {
      const body = await parseJsonBody(request, projectCreateSchema);
      return createProject({
        id: body.id,
        name: body.name,
        description: body.description,
        createdAt: body.createdAt,
      });
    },
    { status: 201 }
  );
}
