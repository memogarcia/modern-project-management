import type { GanttChart } from "@/lib/ganttTypes";

/**
 * Storage layer for Gantt charts — mirrors the diagram storage pattern.
 * Reads/writes via Next.js API routes → JSON files in shared diagrams-data dir.
 */

const API_BASE = "/api/gantt";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`.trim();
}

/** Fetch all Gantt charts (sorted newest-first). */
export async function loadGanttCharts(): Promise<GanttChart[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      console.error(`Failed to load Gantt charts: ${await readErrorMessage(res)}`);
      return [];
    }
    return (await res.json()) as GanttChart[];
  } catch (error) {
    console.error("Failed to load Gantt charts", error);
    return [];
  }
}

/** Fetch a single Gantt chart by ID. */
export async function loadGanttChart(id: string): Promise<GanttChart | null> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as GanttChart;
}

/** Create or update a Gantt chart. */
export async function saveGanttChart(chart: GanttChart): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...chart,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save Gantt chart: ${await readErrorMessage(res)}`);
  }
}

/** Delete a Gantt chart by ID. */
export async function deleteGanttChart(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete Gantt chart: ${await readErrorMessage(res)}`);
  }
}
