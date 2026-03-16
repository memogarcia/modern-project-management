"use client";

import { useState } from "react";
import type { KanbanProject, KanbanTask, KanbanColumn } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";

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
    <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0, overflowX: "auto", padding: "0 2px 2px" }}>
      {columns.map((col) => {
        const tasks = project.tasks
          .filter((t) => t.columnId === col.id)
          .sort((a, b) => a.position - b.position);
        const isDragOver = dragOverCol === col.id;
        const isOverWip = col.wipLimit !== undefined && tasks.length >= col.wipLimit;

        return (
          <div
            key={col.id}
            style={{
              flex: "1 1 0",
              minWidth: 240,
              maxWidth: 360,
              background: "var(--panel-bg)",
              border: `1.5px solid ${isDragOver ? col.color : "var(--border)"}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transition: "border-color 0.15s",
              boxShadow: isDragOver ? `0 0 0 2px ${col.color}30` : undefined,
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.id); }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null);
            }}
            onDrop={() => handleDrop(col.id)}
          >
            {/* Column header */}
            <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: col.color, display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--foreground)", letterSpacing: "0.01em" }}>
                    {col.name}
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, background: `${col.color}18`, color: col.color,
                    borderRadius: 20, padding: "1px 7px", minWidth: 18, textAlign: "center",
                  }}>
                    {tasks.length}
                  </span>
                  {col.wipLimit !== undefined && (
                    <span style={{
                      fontSize: 10, color: isOverWip ? "#ef4444" : "var(--text-muted)",
                      fontWeight: 600,
                    }}>
                      / {col.wipLimit}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                  title="Add task"
                  style={{
                    width: 26, height: 26, borderRadius: 6, background: "transparent",
                    border: "1px solid var(--border)", color: "var(--text-muted)", cursor: "pointer",
                    fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.1s, color 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = col.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = col.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Task list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 4px", display: "flex", flexDirection: "column", gap: 8 }}>
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
                    style={{
                      background: isSelected ? `${col.color}0a` : "var(--surface)",
                      border: `1px solid ${isSelected ? col.color : "var(--border)"}`,
                      borderRadius: 8, padding: "9px 11px",
                      cursor: dragTaskId === task.id ? "grabbing" : "grab",
                      opacity: dragTaskId === task.id ? 0.45 : 1,
                      transition: "opacity 0.1s, border-color 0.15s",
                    }}
                  >
                    {/* Epic badge */}
                    {epic && (
                      <div style={{
                        fontSize: 10, fontWeight: 600, color: epic.color ?? "var(--text-muted)",
                        marginBottom: 4, display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: epic.color ?? "var(--text-muted)", display: "inline-block" }} />
                        {epic.name}
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)", lineHeight: 1.45, wordBreak: "break-word" }}>
                        {task.name}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveTask(task.id); }}
                        title="Delete"
                        style={{
                          width: 22, height: 22, padding: 0, background: "transparent", border: "none",
                          color: "var(--text-muted)", cursor: "pointer", borderRadius: 4, fontSize: 16,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#ef444418"; e.currentTarget.style.color = "#ef4444"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Badges row */}
                    <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 10, padding: "1px 6px", borderRadius: 4,
                        background: `${priorityCfg.color}18`, color: priorityCfg.color, fontWeight: 600,
                      }}>
                        {priorityCfg.icon} {priorityCfg.label}
                      </span>
                      {task.assignee && (
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: "var(--surface-hover)", color: "var(--text-muted)", fontWeight: 500,
                        }}>
                          👤 {task.assignee}
                        </span>
                      )}
                      {task.dueDate && (
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: "var(--surface-hover)", color: "var(--text-muted)", fontWeight: 500,
                        }}>
                          📅 {task.dueDate}
                        </span>
                      )}
                      {task.progress > 0 && (
                        <span style={{
                          fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          background: "#22c55e18", color: "#22c55e", fontWeight: 600,
                        }}>
                          {task.progress}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {tasks.length === 0 && addingTo !== col.id && (
                <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-subtle)", fontSize: 12, fontStyle: "italic" }}>
                  No tasks yet
                </div>
              )}
            </div>

            {/* Add task form */}
            <div style={{ padding: "8px 10px", flexShrink: 0 }}>
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
                    style={{
                      width: "100%", padding: "7px 9px", background: "var(--background)",
                      border: `1px solid ${col.color}`, borderRadius: 7, color: "var(--foreground)",
                      fontSize: 13, resize: "none", outline: "none", boxSizing: "border-box",
                      fontFamily: "inherit", marginBottom: 6,
                    }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => confirmAdd(col.id)}
                      style={{
                        flex: 1, padding: "6px", background: col.color, color: "#fff",
                        border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      }}
                    >
                      Add task
                    </button>
                    <button
                      onClick={() => { setAddingTo(null); setNewTitle(""); }}
                      style={{
                        flex: 1, padding: "6px", background: "transparent", color: "var(--text-muted)",
                        border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { setAddingTo(col.id); setNewTitle(""); }}
                  style={{
                    width: "100%", padding: "7px", background: "transparent",
                    border: "1px dashed var(--border)", borderRadius: 7, color: "var(--text-muted)",
                    cursor: "pointer", fontSize: 12, fontWeight: 500, transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
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
