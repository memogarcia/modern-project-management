import type { KanbanProject, KanbanProjectMeta } from "@/lib/projectTypes";

/**
 * Client storage layer for projects — reads/writes via Next.js API routes.
 */

const API_BASE = "/api/projects";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data?.error === "string" && data.error) return data.error;
  } catch {
    // ignore
  }
  return `${res.status} ${res.statusText}`.trim();
}

/** Fetch all projects (sorted newest-first). */
export async function loadProjects(): Promise<KanbanProjectMeta[]> {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) {
      console.error(`Failed to load projects: ${await readErrorMessage(res)}`);
      return [];
    }
    return (await res.json()) as KanbanProjectMeta[];
  } catch (error) {
    console.error("Failed to load projects", error);
    return [];
  }
}

/** Fetch a single project by ID. */
export async function loadProject(id: string): Promise<KanbanProject | null> {
  const res = await fetch(`${API_BASE}/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }
  return (await res.json()) as KanbanProject;
}

/** Create or update a project. */
export async function saveProject(project: KanbanProject): Promise<void> {
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...project,
      updatedAt: new Date().toISOString(),
    }),
  });
  if (!res.ok) {
    throw new Error(`Failed to save project: ${await readErrorMessage(res)}`);
  }
}

/** Delete a project by ID. */
export async function deleteProject(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`Failed to delete project: ${await readErrorMessage(res)}`);
  }
}
