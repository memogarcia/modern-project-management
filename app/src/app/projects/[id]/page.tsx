"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import KanbanBoardView from "@/components/KanbanBoardView";
import GanttChartView from "@/components/GanttChartView";
import KanbanCalendarView from "@/components/KanbanCalendarView";
import MatrixView from "@/components/MatrixView";
import SessionsView from "@/components/SessionsView";
import type { KanbanViewMode } from "@/lib/projectTypes";
import { KanbanSquare, BarChart3, Calendar, Grid3X3, Timer, AlertCircle, Layers } from "lucide-react";
import TaskDetailModal from "@/components/TaskDetailModal";

const VIEW_TABS: { key: KanbanViewMode; label: string; icon: typeof KanbanSquare }[] = [
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "gantt", label: "Gantt", icon: BarChart3 },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "matrix", label: "Matrix", icon: Grid3X3 },
  { key: "sessions", label: "Sessions", icon: Timer },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const project = useProjectStore((s) => s.project);
  const loadError = useProjectStore((s) => s.loadError);
  const isLoading = useProjectStore((s) => s.isLoading);
  const persistError = useProjectStore((s) => s.persistError);
  const activeView = useProjectStore((s) => s.activeView);
  const selectedTaskId = useProjectStore((s) => s.selectedTaskId);
  const loadProject = useProjectStore((s) => s.loadProject);
  const setActiveView = useProjectStore((s) => s.setActiveView);
  const selectTask = useProjectStore((s) => s.selectTask);
  const addTask = useProjectStore((s) => s.addTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const moveTask = useProjectStore((s) => s.moveTask);
  const removeTask = useProjectStore((s) => s.removeTask);
  const updateMeta = useProjectStore((s) => s.updateMeta);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  useEffect(() => {
    void loadProject(id);
  }, [id, loadProject]);

  // Deep link: ?view=gantt|calendar|matrix|kanban|sessions
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["kanban", "gantt", "calendar", "matrix", "sessions"].includes(viewParam)) {
      setActiveView(viewParam as KanbanViewMode);
    }
  }, [searchParams, setActiveView]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)" }}>
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)", gap: 16 }}>
        <AlertCircle size={48} style={{ opacity: 0.4 }} />
        <div>{loadError ?? "Project not found"}</div>
        <button
          onClick={() => router.push("/projects")}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          ← Back to projects
        </button>
      </div>
    );
  }

  const handleAddTaskFromBoard = (columnId: string, name: string) => {
    // Use the first epic, or create a default one
    const epicId = project.epics[0]?.id;
    if (!epicId) {
      // Auto-create a "General" epic
      const store = useProjectStore.getState();
      const newEpicId = store.addEpic("General", "Default epic", "#6b7280");
      addTask({ epicId: newEpicId, columnId, name });
    } else {
      addTask({ epicId, columnId, name });
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--background)", color: "var(--foreground)", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--panel-bg)",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <button
          onClick={() => router.push("/projects")}
          style={{ padding: "6px 10px", background: "transparent", color: "var(--text-muted)", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          Projects
        </button>
        <span style={{ color: "var(--border)", fontSize: 16 }}>/</span>

        {editingName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") { updateMeta(nameInput); setEditingName(false); }
                if (e.key === "Escape") setEditingName(false);
              }}
              style={{
                padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, color: "var(--foreground)", fontSize: 14, fontWeight: 700,
                outline: "none", width: 240,
              }}
            />
            <button
              onClick={() => { updateMeta(nameInput); setEditingName(false); }}
              style={{ padding: "4px 12px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        ) : (
          <div
            style={{ flex: 1, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => { setNameInput(project.name); setEditingName(true); }}
            title="Click to rename"
          >
            <Layers size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{project.name}</span>
          </div>
        )}

        {persistError && (
          <span style={{ fontSize: 11, color: "#ef4444", padding: "3px 8px", background: "#ef444418", borderRadius: 6 }}>
            Save failed
          </span>
        )}

        {/* View tabs */}
        <div style={{ display: "flex", gap: 2, background: "var(--surface)", borderRadius: 8, padding: 2 }}>
          {VIEW_TABS.map(({ key, label, icon: Icon }) => {
            const isActive = activeView === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveView(key); router.push(`/projects/${id}?view=${key}`, { scroll: false }); }}
                style={{
                  padding: "5px 12px", background: isActive ? "var(--panel-bg)" : "transparent",
                  border: "none", borderRadius: 6, color: isActive ? "var(--foreground)" : "var(--text-muted)",
                  fontSize: 12, fontWeight: isActive ? 600 : 500, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5,
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.1)" : undefined,
                  transition: "all 0.15s",
                }}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </div>

        <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "3px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20 }}>
          {project.tasks.length} {project.tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Active view */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: activeView === "matrix" ? 16 : 20 }}>
        {activeView === "kanban" && (
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
        {activeView === "gantt" && <GanttChartView project={project} onSelectTask={selectTask} />}
        {activeView === "calendar" && <KanbanCalendarView project={project} onSelectTask={selectTask} />}
        {activeView === "matrix" && (
          <MatrixView
            project={project}
            onUpdateTask={(taskId, updates) => updateTask(taskId, updates)}
            onSelectTask={selectTask}
          />
        )}
        {activeView === "sessions" && (
          <SessionsView project={project} onSelectTask={selectTask} />
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
