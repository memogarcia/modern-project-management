"use client";

import { useState } from "react";
import type { KanbanProject, KanbanTask, KanbanColumn } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { cn } from "@/lib/utils";

interface KanbanBoardViewProps {
  project: KanbanProject;
  onAddTask: (columnId: string, name: string) => void;
  onMoveTask: (taskId: string, columnId: string, position: number) => void;
  onUpdateTask: (taskId: string, updates: Partial<KanbanTask>) => void;
  onRemoveTask: (taskId: string) => void;
  onSelectTask: (taskId: string | null) => void;
  selectedTaskId: string | null;
}

export default function KanbanBoardView({
  project,
  onAddTask,
  onMoveTask,
  onUpdateTask,
  onRemoveTask,
  onSelectTask,
  selectedTaskId,
}: KanbanBoardViewProps) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const columns = [...project.columns].sort((a, b) => a.position - b.position);

  const confirmAdd = (columnId: string) => {
    if (!newTitle.trim()) { setAddingTo(null); return; }
    onAddTask(columnId, newTitle.trim());
    setNewTitle("");
    setAddingTo(null);
  };

  const handleDrop = (targetColumnId: string) => {
    if (!dragTaskId) return;
    const task = project.tasks.find((t) => t.id === dragTaskId);
    if (task && task.columnId !== targetColumnId) {
      const tasksInTarget = project.tasks
        .filter((t) => t.columnId === targetColumnId)
        .sort((a, b) => a.position - b.position);
      onMoveTask(dragTaskId, targetColumnId, tasksInTarget.length);
    }
    setDragTaskId(null);
    setDragOverCol(null);
  };

  const getEpicForTask = (task: KanbanTask) =>
    project.epics.find((e) => e.id === task.epicId);

  return (
    <div className="flex flex-1 gap-3.5 min-h-0 overflow-x-auto px-0.5 pb-0.5">
      {columns.map((col) => {
        const tasks = project.tasks
          .filter((t) => t.columnId === col.id)
          .sort((a, b) => a.position - b.position);
        const isDragOver = dragOverCol === col.id;
        const isOverWip = col.wipLimit !== undefined && tasks.length >= col.wipLimit;

        return (
          <div
            key={col.id}
            className={cn(
              "flex flex-1 min-w-60 max-w-[360px] flex-col overflow-hidden rounded-xl border-[1.5px] bg-[var(--panel-bg)] transition-[border-color,box-shadow] duration-150",
              isDragOver ? "shadow-[0_0_0_2px_var(--accent-soft)]" : ""
            )}
            style={{
              borderColor: isDragOver ? col.color : "var(--border)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
            }}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2.5 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: col.color }}
                />
                <span className="text-[13px] font-bold text-[var(--foreground)] tracking-[0.01em]">
                  {col.name}
                </span>
                <Badge color={col.color} size="sm">{tasks.length}</Badge>
                {col.wipLimit !== undefined && (
                  <span className={cn("text-[10px] font-semibold", isOverWip ? "text-[var(--danger)]" : "text-[var(--text-muted)]")}>
                    / {col.wipLimit}
                  </span>
                )}
              </div>
              <button
                onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                title="Add task"
                className="flex items-center justify-center w-7 h-7 rounded-md border border-[var(--border)] bg-transparent text-[var(--text-muted)] text-lg leading-none cursor-pointer transition-all duration-100 hover:text-white hover:border-transparent"
                style={{ "--hover-bg": col.color } as React.CSSProperties}
                onMouseEnter={(e) => { e.currentTarget.style.background = col.color; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                +
              </button>
            </div>

            {/* Task list */}
            <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5 pb-1">
              {tasks.map((task) => {
                const epic = getEpicForTask(task);
                const priorityCfg = PRIORITY_CONFIG[task.priority];
                const isSelected = selectedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDragTaskId(task.id)}
                    onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
                    onClick={() => onSelectTask(task.id)}
                    className={cn(
                      "group/task rounded-lg border p-2.5 shadow-sm transition-all duration-150 cursor-grab active:cursor-grabbing",
                      "hover:shadow-md hover:-translate-y-px",
                      isSelected ? "bg-[var(--surface-hover)]" : "bg-[var(--surface)]",
                      dragTaskId === task.id && "opacity-40"
                    )}
                    style={{
                      borderColor: isSelected ? col.color : "var(--border)",
                    }}
                  >
                    {/* Epic badge */}
                    {epic && (
                      <div className="flex items-center gap-1 mb-1 text-[11px] font-semibold" style={{ color: epic.color ?? "var(--text-muted)" }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: epic.color ?? "var(--text-muted)" }} />
                        {epic.name}
                      </div>
                    )}

                    <div className="flex items-start gap-1.5">
                      <span className="flex-1 text-[13px] text-[var(--foreground)] leading-[1.45] break-words">
                        {task.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm("Delete this task?")) onRemoveTask(task.id); }}
                        title="Delete"
                        className="flex items-center justify-center w-5 h-5 shrink-0 rounded bg-transparent border-none text-[var(--text-muted)] cursor-pointer opacity-0 group-hover/task:opacity-100 transition-all duration-150 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      >
                        ×
                      </button>
                    </div>

                    {/* Badges row */}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <Badge color={priorityCfg.color} size="sm">
                        {priorityCfg.icon} {priorityCfg.label}
                      </Badge>
                      {task.assignee && (
                        <Badge size="sm">👤 {task.assignee}</Badge>
                      )}
                      {task.dueDate && (
                        <Badge size="sm">📅 {task.dueDate}</Badge>
                      )}
                      {task.progress > 0 && (
                        <Badge color="#22c55e" size="sm">{task.progress}%</Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {tasks.length === 0 && addingTo !== col.id && (
                <EmptyState title="No tasks yet" compact className="py-5" />
              )}
            </div>

            {/* Add task form */}
            <div className="p-2.5 shrink-0">
              {addingTo === col.id ? (
                <div>
                  <textarea
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task name…"
                    autoFocus
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); confirmAdd(col.id); }
                      if (e.key === "Escape") { setAddingTo(null); setNewTitle(""); }
                    }}
                    className="w-full p-2 bg-[var(--background)] rounded-lg text-[var(--foreground)] text-[13px] resize-none outline-none border font-[inherit] mb-1.5 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                    style={{ borderColor: col.color }}
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => confirmAdd(col.id)}
                      className="flex-1 py-1.5 text-white border-none rounded-md cursor-pointer text-xs font-semibold"
                      style={{ background: col.color }}
                    >
                      Add task
                    </button>
                    <button
                      onClick={() => { setAddingTo(null); setNewTitle(""); }}
                      className="flex-1 py-1.5 bg-transparent text-[var(--text-muted)] border border-[var(--border)] rounded-md cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                  className="w-full py-2 bg-transparent border border-dashed border-[var(--border)] rounded-lg text-[var(--text-muted)] cursor-pointer text-xs font-medium transition-colors duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + Add task
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
