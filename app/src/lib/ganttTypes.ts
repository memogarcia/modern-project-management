// ─── Gantt Chart Types ───────────────────────────────────────────────

export type TaskStatus = "not-started" | "in-progress" | "completed" | "blocked" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type ViewMode = "day" | "week" | "month";

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
  startDate: string;   // ISO date string (YYYY-MM-DD)
  endDate: string;      // ISO date string (YYYY-MM-DD)
  progress: number;     // 0-100
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  group?: string;       // group/section name for grouping tasks
  color?: string;       // custom color override
  description?: string;
  links: TaskLink[];
  dependencies: TaskDependency[];
  metadata: Record<string, string>; // arbitrary key-value pairs
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

// ─── Status Config ───────────────────────────────────────────────────
export const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; darkColor: string; icon: string }> = {
  "not-started": { label: "Not Started", color: "#94a3b8", darkColor: "#64748b", icon: "⏳" },
  "in-progress": { label: "In Progress", color: "#3b82f6", darkColor: "#2563eb", icon: "🔄" },
  "completed": { label: "Completed", color: "#22c55e", darkColor: "#16a34a", icon: "✅" },
  "blocked": { label: "Blocked", color: "#ef4444", darkColor: "#dc2626", icon: "🚫" },
  "cancelled": { label: "Cancelled", color: "#6b7280", darkColor: "#4b5563", icon: "❌" },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  low: { label: "Low", color: "#94a3b8", icon: "▽" },
  medium: { label: "Medium", color: "#f59e0b", icon: "◆" },
  high: { label: "High", color: "#f97316", icon: "▲" },
  critical: { label: "Critical", color: "#ef4444", icon: "⚠️" },
};

export const LINK_TYPE_CONFIG: Record<TaskLink["type"], { label: string; icon: string; color: string }> = {
  "jira": { label: "Jira", icon: "🎫", color: "#0052CC" },
  "github-pr": { label: "GitHub PR", icon: "🔀", color: "#238636" },
  "github-issue": { label: "GitHub Issue", icon: "🐛", color: "#8b949e" },
  "confluence": { label: "Confluence", icon: "📄", color: "#1868DB" },
  "slack": { label: "Slack", icon: "💬", color: "#4A154B" },
  "other": { label: "Link", icon: "🔗", color: "#6b7280" },
};

// ─── Helpers ─────────────────────────────────────────────────────────
export function getTaskDurationDays(task: GanttTask): number {
  const start = new Date(task.startDate);
  const end = new Date(task.endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

export function getTaskColor(task: GanttTask): string {
  if (task.color) return task.color;
  return STATUS_CONFIG[task.status]?.color ?? "#3b82f6";
}

export function createEmptyTask(id: string): GanttTask {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return {
    id,
    name: "New Task",
    startDate: today.toISOString().split("T")[0],
    endDate: nextWeek.toISOString().split("T")[0],
    progress: 0,
    status: "not-started",
    priority: "medium",
    links: [],
    dependencies: [],
    metadata: {},
  };
}
