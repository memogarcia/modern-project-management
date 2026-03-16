import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { KanbanProject } from "@/lib/projectTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { listJsonFilesSafe, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeId(id: unknown): id is string {
  return typeof id === "string" && SAFE_ID_RE.test(id);
}

function projectsDir(): string {
  const base = ensureDiagramsDir();
  const dir = path.join(base, "projects");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** GET /api/projects — list all projects (summary) */
export async function GET() {
  const dir = projectsDir();
  const projects = listJsonFilesSafe<KanbanProject>(dir);

  const summary = projects
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      epicCount: p.epics?.length ?? 0,
      taskCount: p.tasks?.length ?? 0,
      columnCount: p.columns?.length ?? 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

  return NextResponse.json(summary);
}

/** POST /api/projects — create or update a project */
export async function POST(req: Request) {
  const dir = projectsDir();
  let project: KanbanProject;
  try {
    project = (await req.json()) as KanbanProject;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!project.id) {
    return NextResponse.json({ error: "Missing project id" }, { status: 400 });
  }
  if (!isSafeId(project.id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const filePath = path.join(dir, `${project.id}.json`);
  writeJsonFileAtomic(filePath, project);
  return NextResponse.json({ ok: true, id: project.id });
}
