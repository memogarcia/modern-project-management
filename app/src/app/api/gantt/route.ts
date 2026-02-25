import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import type { GanttChart } from "@/lib/ganttTypes";
import { ensureDiagramsDir } from "@/lib/diagramsDir.server";

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
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

  const charts: GanttChart[] = files.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), "utf-8");
    return JSON.parse(raw) as GanttChart;
  });

  charts.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return NextResponse.json(charts);
}

/** POST /api/gantt — create or update a Gantt chart */
export async function POST(req: Request) {
  const dir = ganttDir();
  const chart = (await req.json()) as GanttChart;

  if (!chart.id) {
    return NextResponse.json({ error: "Missing chart id" }, { status: 400 });
  }
  if (!isSafeId(chart.id)) {
    return NextResponse.json({ error: "Invalid chart id" }, { status: 400 });
  }

  const filePath = path.join(dir, `${chart.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(chart, null, 2), "utf-8");
  return NextResponse.json({ ok: true, id: chart.id });
}
