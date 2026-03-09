import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { GanttChart } from "@/lib/ganttTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";
import { listJsonFilesSafe, writeJsonFileAtomic } from "@/lib/jsonFiles.server";

const SAFE_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function isSafeId(id: unknown): id is string {
  return typeof id === "string" && SAFE_ID_RE.test(id);
}

/** Gantt charts stored in a "gantt" subdirectory of the shared data dir. */
function ganttDir(): string {
  const base = ensureDiagramsDir();
  const dir = path.join(base, "gantt");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** GET /api/gantt — list all Gantt charts */
export async function GET() {
  const dir = ganttDir();
  const charts = listJsonFilesSafe<GanttChart>(dir);

  charts.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json(charts);
}

/** POST /api/gantt — create or update a Gantt chart */
export async function POST(req: Request) {
  const dir = ganttDir();
  let chart: GanttChart;
  try {
    chart = (await req.json()) as GanttChart;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!chart.id) {
    return NextResponse.json({ error: "Missing chart id" }, { status: 400 });
  }
  if (!isSafeId(chart.id)) {
    return NextResponse.json({ error: "Invalid chart id" }, { status: 400 });
  }

  const filePath = path.join(dir, `${chart.id}.json`);
  writeJsonFileAtomic(filePath, chart);
  return NextResponse.json({ ok: true, id: chart.id });
}
