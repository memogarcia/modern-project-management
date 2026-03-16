import { NextResponse } from "next/server";
import type { KanbanProject } from "@/lib/projectTypes";
import { listProjects, upsertProject } from "@/lib/db.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

/** GET /api/projects — list all projects (summary) */
export async function GET() {
  const projects = listProjects();
  return NextResponse.json(projects);
}

/** POST /api/projects — create or update a project */
export async function POST(req: Request) {
  let project: KanbanProject;
  try {
    project = (await req.json()) as KanbanProject;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!project.id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }
  if (!SAFE_ID_RE.test(project.id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  upsertProject(project);
  return NextResponse.json({ ok: true, id: project.id });
}
