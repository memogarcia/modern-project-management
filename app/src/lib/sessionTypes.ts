export type TaskStatus = "not-started" | "in-progress" | "completed" | "blocked" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

// ─── Session Types ───────────────────────────────────────────────────
export interface SessionLink {
  label: string;
  url: string;
  type: "diagram" | "gantt" | "matrix" | "github" | "other";
}

export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session extends SessionMeta {
  notes: string;
  tasks: string[];
  links: SessionLink[];
  pomodorosCompleted: number;
}
