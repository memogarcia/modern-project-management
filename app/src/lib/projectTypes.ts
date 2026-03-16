// ─── Project Types (Unified Task Management) ────────────────────────

export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  position: number;
  wipLimit?: number;
}

export interface KanbanProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSession {
  id: string;
  title: string;
  notes: string;
  taskIds: string[];
  pomodorosCompleted: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanProject extends KanbanProjectMeta {
  columns: KanbanColumn[];
  epics: KanbanEpic[];
  tasks: KanbanTask[];
  sessions: ProjectSession[];
  diagramIds: string[];
}

export interface KanbanEpic {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export type KanbanTaskPriority = "low" | "medium" | "high" | "critical";

export interface KanbanTaskLink {
  label: string;
  url: string;
  type: "jira" | "github-pr" | "github-issue" | "confluence" | "slack" | "other";
}

export interface TaskDependency {
  taskId: string;
  type: "finish-to-start" | "start-to-start" | "finish-to-finish" | "start-to-finish";
}

export interface KanbanTask {
  id: string;
  epicId: string;
  columnId: string;
  name: string;
  description?: string;
  priority: KanbanTaskPriority;
  assignee?: string;
  tags: string[];
  startDate?: string;
  dueDate?: string;
  progress: number;
  position: number;
  links: KanbanTaskLink[];
  dependencies?: TaskDependency[];
  color?: string;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ─── Default Columns ─────────────────────────────────────────────────

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "backlog", name: "Backlog", color: "#94a3b8", position: 0 },
  { id: "todo", name: "To Do", color: "#3b82f6", position: 1 },
  { id: "in-progress", name: "In Progress", color: "#f59e0b", position: 2 },
  { id: "review", name: "Review", color: "#8b5cf6", position: 3 },
  { id: "done", name: "Done", color: "#22c55e", position: 4 },
];

// ─── UI Config Maps ──────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<KanbanTaskPriority, { label: string; color: string; icon: string }> = {
  low: { label: "Low", color: "#94a3b8", icon: "▽" },
  medium: { label: "Medium", color: "#f59e0b", icon: "◆" },
  high: { label: "High", color: "#f97316", icon: "▲" },
  critical: { label: "Critical", color: "#ef4444", icon: "⚠️" },
};

export const LINK_TYPE_CONFIG: Record<KanbanTaskLink["type"], { label: string; icon: string; color: string }> = {
  jira: { label: "Jira", icon: "🎫", color: "#0052CC" },
  "github-pr": { label: "GitHub PR", icon: "🔀", color: "#238636" },
  "github-issue": { label: "GitHub Issue", icon: "🐛", color: "#8b949e" },
  confluence: { label: "Confluence", icon: "📄", color: "#1868DB" },
  slack: { label: "Slack", icon: "💬", color: "#4A154B" },
  other: { label: "Link", icon: "🔗", color: "#6b7280" },
};

// ─── Matrix Quadrant Derivation ──────────────────────────────────────

export type MatrixQuadrant = "do-first" | "schedule" | "delegate" | "drop";

export const QUADRANT_CONFIG: Record<MatrixQuadrant, { label: string; tag: string; color: string; icon: string }> = {
  "do-first": { label: "Do First", tag: "Critical", color: "#ef4444", icon: "🔴" },
  schedule: { label: "Schedule", tag: "High", color: "#f59e0b", icon: "🟡" },
  delegate: { label: "Delegate", tag: "Medium", color: "#3b82f6", icon: "🔵" },
  drop: { label: "Drop", tag: "Low", color: "#6b7280", icon: "⚪" },
};

export function deriveQuadrant(priority: KanbanTaskPriority): MatrixQuadrant {
  switch (priority) {
    case "critical": return "do-first";
    case "high": return "schedule";
    case "medium": return "delegate";
    case "low": return "drop";
  }
}

// ─── View Types ──────────────────────────────────────────────────────

export type KanbanViewMode = "overview" | "kanban" | "gantt" | "calendar" | "matrix" | "sessions";

// ─── Status Derivation (for Gantt-like status from Kanban column) ────

export type DerivedTaskStatus = "not-started" | "in-progress" | "completed" | "blocked";

export const DERIVED_STATUS_CONFIG: Record<DerivedTaskStatus, { label: string; color: string; icon: string }> = {
  "not-started": { label: "Not Started", color: "#94a3b8", icon: "⏳" },
  "in-progress": { label: "In Progress", color: "#3b82f6", icon: "🔄" },
  completed: { label: "Completed", color: "#22c55e", icon: "✅" },
  blocked: { label: "Blocked", color: "#ef4444", icon: "🚫" },
};

export function deriveStatusFromColumn(columnId: string): DerivedTaskStatus {
  switch (columnId) {
    case "done":
      return "completed";
    case "in-progress":
    case "review":
      return "in-progress";
    default:
      return "not-started";
  }
}
