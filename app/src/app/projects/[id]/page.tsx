"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useProjectStore } from "@/store/projectStore";
import KanbanBoardView from "@/components/KanbanBoardView";
import GanttChartView from "@/components/GanttChartView";
import KanbanCalendarView from "@/components/KanbanCalendarView";
import MatrixView from "@/components/MatrixView";
import SessionsView from "@/components/SessionsView";
import ProjectDiagramsView from "@/components/ProjectDiagramsView";
import McpConfigView from "@/components/McpConfigView";
import type { KanbanViewMode } from "@/lib/projectTypes";
import { AlertCircle } from "lucide-react";
import TaskDetailModal from "@/components/TaskDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExtendedViewMode = KanbanViewMode | "mcp";

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const project = useProjectStore((s) => s.project);
  const loadError = useProjectStore((s) => s.loadError);
  const isLoading = useProjectStore((s) => s.isLoading);
  const activeView = useProjectStore((s) => s.activeView);
  const selectedTaskId = useProjectStore((s) => s.selectedTaskId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const selectTask = useProjectStore((s) => s.selectTask);
  const addTask = useProjectStore((s) => s.addTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const moveTask = useProjectStore((s) => s.moveTask);
  const removeTask = useProjectStore((s) => s.removeTask);

  // Read the ?view= parameter
  const viewParam = searchParams.get("view") as ExtendedViewMode | null;
  const currentView: ExtendedViewMode = viewParam && ["kanban", "gantt", "calendar", "matrix", "sessions", "diagrams", "mcp"].includes(viewParam)
    ? viewParam
    : activeView;

  useEffect(() => {
    void loadProject(id);
  }, [id, loadProject]);

  // Sync the store's activeView with URL
  useEffect(() => {
    if (viewParam && viewParam !== "mcp" && ["kanban", "gantt", "calendar", "matrix", "sessions", "diagrams"].includes(viewParam)) {
      setActiveView(viewParam as KanbanViewMode);
    }
  }, [viewParam, setActiveView]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--background)] text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[var(--accent)] border-r-transparent" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[var(--background)] text-[var(--text-muted)]">
        <AlertCircle className="h-10 w-10 opacity-40" />
        <div className="text-sm">{loadError ?? "Project not found"}</div>
        <Button size="sm" onClick={() => router.push("/projects")}>
          ← Back to projects
        </Button>
      </div>
    );
  }

  const handleAddTaskFromBoard = (columnId: string, name: string) => {
    const epicId = project.epics[0]?.id;
    if (!epicId) {
      const store = useProjectStore.getState();
      const newEpicId = store.addEpic("General", "Default epic", "#6b7280");
      addTask({ epicId: newEpicId, columnId, name });
    } else {
      addTask({ epicId, columnId, name });
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Full-bleed view area — no top header, sidebar handles navigation */}
      <div className={cn(
        "flex flex-1 flex-col overflow-hidden",
        currentView === "matrix" ? "p-3" : currentView === "mcp" ? "p-0" : "p-4"
      )}>
        {currentView === "kanban" && (
          <KanbanBoardView
            project={project}
            onAddTask={handleAddTaskFromBoard}
            onMoveTask={(taskId, columnId, position) => moveTask(taskId, columnId, position)}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
            onRemoveTask={removeTask}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        )}
        {currentView === "gantt" && <GanttChartView project={project} onSelectTask={selectTask} />}
        {currentView === "calendar" && <KanbanCalendarView project={project} onSelectTask={selectTask} />}
        {currentView === "matrix" && (
          <MatrixView
            project={project}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
            onSelectTask={selectTask}
          />
        )}
        {currentView === "sessions" && (
          <SessionsView project={project} onSelectTask={selectTask} />
        )}
        {currentView === "diagrams" && (
          <ProjectDiagramsView project={project} />
        )}
        {currentView === "mcp" && (
          <McpConfigView project={project} />
        )}
      </div>

      {/* Task detail modal */}
      {selectedTaskId && (() => {
        const selectedTask = project.tasks.find((t) => t.id === selectedTaskId);
        if (!selectedTask) return null;
        return (
          <TaskDetailModal
            task={selectedTask}
            project={project}
            onClose={() => selectTask(null)}
            onUpdate={(taskId, updates) => updateTask(taskId, updates)}
            onDelete={removeTask}
          />
        );
      })()}
    </div>
  );
}
