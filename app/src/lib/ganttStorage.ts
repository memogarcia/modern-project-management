import type { ProjectDocument, ProjectSummary, ProjectTask } from "@/lib/ganttTypes";
import { ganttClient } from "@/lib/ganttClient";

export async function loadProjects(): Promise<ProjectSummary[]> {
  try {
    return await ganttClient.list();
  } catch (error) {
    console.error("Failed to load projects", error);
    return [];
  }
}

export async function loadProject(id: string): Promise<ProjectDocument | null> {
  return ganttClient.get(id);
}

export async function createProject(input: {
  id?: string;
  name: string;
  description?: string;
  createdAt?: string;
}): Promise<ProjectDocument> {
  return ganttClient.create(input);
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    description?: string;
  }
): Promise<ProjectDocument> {
  return ganttClient.update(id, patch);
}

export async function deleteProject(id: string): Promise<void> {
  return ganttClient.remove(id);
}

export async function saveProjectTask(
  projectId: string,
  task: {
    id?: string;
    epicId?: string | null;
    columnId?: string;
    name: string;
    description?: string;
    priority: ProjectTask["priority"];
    assignee?: string;
    startDate?: string | null;
    dueDate?: string | null;
    progress?: number;
    position?: number;
    color?: string | null;
    tags?: string[];
    links?: Array<Omit<ProjectTask["links"][number], "id">>;
    dependencies?: Array<Omit<ProjectTask["dependencies"][number], "id" | "taskId">>;
    metadata?: ProjectTask["metadata"];
    createdAt?: string;
    updatedAt?: string;
  }
): Promise<ProjectTask> {
  return ganttClient.saveTask(projectId, task);
}

export async function deleteProjectTask(projectId: string, taskId: string): Promise<void> {
  return ganttClient.removeTask(projectId, taskId);
}
