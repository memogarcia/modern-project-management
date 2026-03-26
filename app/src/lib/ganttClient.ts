import type { ProjectDocument, ProjectSummary, ProjectTask } from "@/lib/ganttTypes";
import { patchJson, postJson, requestJson, requestOptionalJson, requestVoid } from "@/lib/request";

const API_BASE = "/api/projects";

type ProjectPayload = {
  id?: string;
  name: string;
  description?: string;
  createdAt?: string;
};

type ProjectTaskPayload = {
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
};

export const ganttClient = {
  list(): Promise<ProjectSummary[]> {
    return requestJson<ProjectSummary[]>(API_BASE);
  },

  get(id: string): Promise<ProjectDocument | null> {
    return requestOptionalJson<ProjectDocument>(`${API_BASE}/${id}`);
  },

  create(payload: ProjectPayload): Promise<ProjectDocument> {
    return postJson<ProjectDocument>(API_BASE, payload);
  },

  update(id: string, payload: Partial<ProjectPayload>): Promise<ProjectDocument> {
    return patchJson<ProjectDocument>(`${API_BASE}/${id}`, payload);
  },

  remove(id: string): Promise<void> {
    return requestVoid(`${API_BASE}/${id}`, { method: "DELETE" });
  },

  saveTask(projectId: string, payload: ProjectTaskPayload): Promise<ProjectTask> {
    return postJson<ProjectTask>(`${API_BASE}/${projectId}/tasks`, payload);
  },

  removeTask(projectId: string, taskId: string): Promise<void> {
    return requestVoid(`${API_BASE}/${projectId}/tasks/${taskId}`, { method: "DELETE" });
  },
};
