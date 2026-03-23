"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import KanbanBoardView from "@/components/KanbanBoardView";
import GanttChartView from "@/components/GanttChartView";
import KanbanCalendarView from "@/components/KanbanCalendarView";
import MatrixView from "@/components/MatrixView";
import SessionsView from "@/components/SessionsView";
import ProjectDiagramsView from "@/components/ProjectDiagramsView";
import McpConfigView from "@/components/McpConfigView";
import CreateItemModal from "@/components/CreateItemModal";
import type { CreateItemMode, CreateItemDefaults } from "@/components/CreateItemModal";
import type { KanbanViewMode } from "@/lib/projectTypes";
import { AlertCircle, Plus, ChevronRight } from "lucide-react";
import TaskDetailModal from "@/components/TaskDetailModal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExtendedViewMode = KanbanViewMode | "mcp";

const VIEW_LABELS: Record<string, string> = {
  kanban: "Kanban",
  gantt: "Gantt",
  calendar: "Calendar",
  matrix: "Matrix",
  sessions: "Sessions",
  diagrams: "Diagrams",
  mcp: "MCP",
};

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
  const addEpic = useProjectStore((s) => s.addEpic);
  const updateTask = useProjectStore((s) => s.updateTask);
  const moveTask = useProjectStore((s) => s.moveTask);
  const removeTask = useProjectStore((s) => s.removeTask);

  // Create modal state
  const [createModal, setCreateModal] = useState<{
    mode: CreateItemMode;
    defaults?: CreateItemDefaults;
  } | null>(null);

  // Read the ?view= parameter
  const viewParam = searchParams.get("view") as ExtendedViewMode | null;
  const currentView: ExtendedViewMode = viewParam && ["kanban", "gantt", "calendar", "matrix", "sessions", "diagrams", "mcp"].includes(viewParam)
    ? viewParam
    : "diagrams";

  useEffect(() => {
    void loadProject(id);
  }, [id, loadProject]);

  // Sync the store's activeView with URL
  useEffect(() => {
    if (viewParam && viewParam !== "mcp" && ["kanban", "gantt", "calendar", "matrix", "sessions", "diagrams"].includes(viewParam)) {
      setActiveView(viewParam as KanbanViewMode);
      return;
    }
    setActiveView("diagrams");
  }, [viewParam, setActiveView]);

  const handleRequestCreate = useCallback((mode: CreateItemMode, defaults?: CreateItemDefaults) => {
    setCreateModal({ mode, defaults });
  }, []);

  const handleCreateTask = useCallback((task: Parameters<typeof addTask>[0]) => {
    if (!project) return;
    let epicId = task.epicId;
    if (!epicId && project.epics.length === 0) {
      epicId = addEpic("General", "Default epic", "#6b7280");
    }
    addTask({ ...task, epicId });
  }, [project, addTask, addEpic]);

  const handleCreateEpic = useCallback((name: string, description?: string, color?: string) => {
    addEpic(name, description, color);
  }, [addEpic]);

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

  const showFab = ["kanban", "gantt", "calendar", "matrix", "sessions"].includes(currentView);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {/* Top header bar — aligned with sidebar header */}
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0 gap-1.5">
        <span className="text-sm text-[var(--text-muted)] truncate">{project.name}</span>
        <ChevronRight size={12} className="text-[var(--text-muted)] shrink-0" />
        <span className="text-sm font-semibold text-[var(--foreground)]">{VIEW_LABELS[currentView] ?? currentView}</span>
      </div>
      {/* Full-bleed view area */}
      <div className={cn(
        "flex flex-1 flex-col overflow-hidden relative",
        currentView === "matrix" ? "p-3" : currentView === "mcp" ? "p-0" : "p-4"
      )}>
        {currentView === "kanban" && (
          <KanbanBoardView
            project={project}
            onRequestCreate={(defaults) => handleRequestCreate("task", defaults)}
            onMoveTask={(taskId, columnId, position) => moveTask(taskId, columnId, position)}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
            onRemoveTask={removeTask}
            onSelectTask={selectTask}
            selectedTaskId={selectedTaskId}
          />
        )}
        {currentView === "gantt" && (
          <GanttChartView
            project={project}
            onSelectTask={selectTask}
            onRequestCreate={(defaults) => handleRequestCreate("task", defaults)}
          />
        )}
        {currentView === "calendar" && (
          <KanbanCalendarView
            project={project}
            onSelectTask={selectTask}
            onRequestCreate={(defaults) => handleRequestCreate("task", defaults)}
          />
        )}
        {currentView === "matrix" && (
          <MatrixView
            project={project}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
            onSelectTask={selectTask}
            onRequestCreate={(defaults) => handleRequestCreate("task", defaults)}
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

        {/* Floating action buttons */}
        {showFab && (
          <div className="absolute bottom-5 right-5 flex gap-2 z-30">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRequestCreate("epic")}
              className="gap-1.5 shadow-lg bg-[var(--panel-bg)] hover:bg-[var(--surface-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> Epic
            </Button>
            <Button
              size="sm"
              onClick={() => handleRequestCreate("task")}
              className="gap-1.5 shadow-lg"
            >
              <Plus className="h-3.5 w-3.5" /> Task
            </Button>
          </div>
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

      {/* Create modal */}
      {createModal && (
        <CreateItemModal
          project={project}
          mode={createModal.mode}
          defaults={createModal.defaults}
          onClose={() => setCreateModal(null)}
          onCreateTask={handleCreateTask}
          onCreateEpic={handleCreateEpic}
        />
      )}
    </div>
  );
}
