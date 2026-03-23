export type {
  ArtifactReference,
  DiagramDocument as Diagram,
  DiagramEdgeMetadata,
  DiagramLinkReference,
  DiagramNodeMetadata,
  DiagramSummary as DiagramMeta,
  KnowledgePattern,
  TroubleshootingSession,
} from "../../shared/planview/domain.js";

// ─── Project Types (Unified Task Management) ─────────────────────────

export interface KanbanColumn {
  id: string;
  name: string;
  color: string; // hex
  position: number; // 0-based ordering
  wipLimit?: number;
}

export interface KanbanProjectMeta {
  id: string;
  name: string;
  description: string;
  createdAt: string; // ISO 8601
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
  tasks: KanbanTask[]; // flat array, NOT nested inside epics
  sessions: ProjectSession[];
  diagramIds: string[];
}

export interface KanbanEpic {
  id: string;
  name: string;
  description?: string;
  color?: string; // badge color
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
  epicId: string; // FK → epic
  columnId: string; // FK → column (Kanban view)
  name: string;
  description?: string;
  priority: KanbanTaskPriority; // Matrix: maps directly to quadrant
  assignee?: string;
  tags: string[];
  startDate?: string; // ISO YYYY-MM-DD (Gantt start)
  dueDate?: string; // ISO YYYY-MM-DD (Gantt end, Calendar date)
  progress: number; // 0-100 (Gantt progress bar)
  position: number; // ordering within column
  links: KanbanTaskLink[];
  dependencies?: TaskDependency[]; // Gantt-style task dependencies
  color?: string; // custom color override
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: "backlog", name: "Backlog", color: "#94a3b8", position: 0 },
  { id: "todo", name: "To Do", color: "#3b82f6", position: 1 },
  { id: "in-progress", name: "In Progress", color: "#f59e0b", position: 2 },
  { id: "review", name: "Review", color: "#8b5cf6", position: 3 },
  { id: "done", name: "Done", color: "#22c55e", position: 4 },
];
