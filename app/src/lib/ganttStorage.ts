import type { GanttChart } from "@/lib/ganttTypes";

/**
 * Storage layer for Gantt charts — mirrors the diagram storage pattern.
 * Reads/writes via Next.js API routes → JSON files in shared diagrams-data dir.
 */

const API_BASE = "/api/gantt";

/** Fetch all Gantt charts (sorted newest-first). */
export async function loadGanttCharts(): Promise<GanttChart[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return [];
    return (await res.json()) as GanttChart[];
  } catch {
    return [];
  }
}

/** Fetch a single Gantt chart by ID. */
export async function loadGanttChart(id: string): Promise<GanttChart | null> {
  try {
    const res = await fetch(`${API_BASE}/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as GanttChart;
  } catch {
    return null;
  }
}

/** Create or update a Gantt chart. */
export async function saveGanttChart(chart: GanttChart): Promise<void> {
  await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...chart,
      updatedAt: new Date().toISOString(),
    }),
  });
}

/** Delete a Gantt chart by ID. */
export async function deleteGanttChart(id: string): Promise<void> {
  await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
}
