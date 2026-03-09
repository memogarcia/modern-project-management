export interface DiagramMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface Diagram extends DiagramMeta {
  mermaidCode: string;
  nodes: unknown[];
  edges: unknown[];
}

// ─── Gantt Chart Types ───────────────────────────────────────────────
export type TaskStatus = "not-started" | "in-progress" | "completed" | "blocked" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskLink {
  label: string;
  url: string;
  type: "jira" | "github-pr" | "github-issue" | "confluence" | "slack" | "other";
}

export interface TaskDependency {
  taskId: string;
  type: "finish-to-start" | "start-to-start" | "finish-to-finish" | "start-to-finish";
}

export interface GanttTask {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  group?: string;
  color?: string;
  description?: string;
  links: TaskLink[];
  dependencies: TaskDependency[];
  metadata: Record<string, string>;
}

export interface GanttChartMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface GanttChart extends GanttChartMeta {
  tasks: GanttTask[];
}

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

// ─── Matrix Types ────────────────────────────────────────────────────
export type MatrixQuadrant = "do-first" | "schedule" | "delegate" | "drop";

export interface MatrixTask {
  id: string;
  title: string;
  quadrant: MatrixQuadrant;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixBoardMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixBoard extends MatrixBoardMeta {
  tasks: MatrixTask[];
}
