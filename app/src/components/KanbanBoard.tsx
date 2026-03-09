"use client";

import { useState } from "react";
import type { MatrixBoard, MatrixTask, MatrixQuadrant } from "@/lib/matrixTypes";

const COLUMNS: { key: MatrixQuadrant; label: string; tag: string; accent: string }[] = [
  { key: "do-first", label: "Do First", tag: "Urgent · Important", accent: "#ef4444" },
  { key: "schedule", label: "Schedule", tag: "Not Urgent · Important", accent: "#f59e0b" },
  { key: "delegate", label: "Delegate", tag: "Urgent · Not Important", accent: "#3b82f6" },
  { key: "drop", label: "Drop", tag: "Not Urgent · Not Important", accent: "#6b7280" },
];

interface KanbanBoardProps {
  board: MatrixBoard;
  onAddTask: (title: string, quadrant: MatrixQuadrant) => void;
  onUpdateTask: (taskId: string, title: string, quadrant: MatrixQuadrant) => void;
  onRemoveTask: (taskId: string) => void;
}

export default function KanbanBoard({
  board,
  onAddTask,
  onUpdateTask,
  onRemoveTask,
}: KanbanBoardProps) {
  const [addingTo, setAddingTo] = useState<MatrixQuadrant | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<MatrixQuadrant | null>(null);

  const startAdd = (quadrant: MatrixQuadrant) => {
    setAddingTo(quadrant);
    setNewTitle("");
  };

  const confirmAdd = (quadrant: MatrixQuadrant) => {
    if (!newTitle.trim()) {
      setAddingTo(null);
      return;
    }
    onAddTask(newTitle.trim(), quadrant);
    setNewTitle("");
    setAddingTo(null);
  };

  const startEdit = (task: MatrixTask) => {
    setEditingId(task.id);
    setEditTitle(task.title);
  };

  const confirmEdit = (task: MatrixTask) => {
    if (editTitle.trim()) {
      onUpdateTask(task.id, editTitle.trim(), task.quadrant);
    }
    setEditingId(null);
    setEditTitle("");
  };

  const handleDrop = (targetQuadrant: MatrixQuadrant) => {
    if (!dragTaskId) return;
    const task = board.tasks.find((t) => t.id === dragTaskId);
    if (task && task.quadrant !== targetQuadrant) {
      onUpdateTask(task.id, task.title, targetQuadrant);
    }
    setDragTaskId(null);
    setDragOverCol(null);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 14,
        flex: 1,
        minHeight: 0,
        overflowX: "auto",
        padding: "0 2px 2px",
      }}
    >
      {COLUMNS.map(({ key, label, tag, accent }) => {
        const tasks = board.tasks.filter((t) => t.quadrant === key);
        const isDragOver = dragOverCol === key;

        return (
          <div
            key={key}
            style={{
              flex: "1 1 0",
              minWidth: 230,
              maxWidth: 340,
              background: "var(--panel-bg)",
              border: `1.5px solid ${isDragOver ? accent : "var(--border)"}`,
              borderRadius: 12,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              transition: "border-color 0.15s",
              boxShadow: isDragOver ? `0 0 0 2px ${accent}30` : undefined,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverCol(key);
            }}
            onDragLeave={(e) => {
              // only clear if leaving the column root
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverCol(null);
              }
            }}
            onDrop={() => handleDrop(key)}
          >
            {/* Column header */}
            <div
              style={{
                padding: "14px 14px 10px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: accent,
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--foreground)",
                      letterSpacing: "0.01em",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${accent}18`,
                      color: accent,
                      borderRadius: 20,
                      padding: "1px 7px",
                      minWidth: 18,
                      textAlign: "center",
                    }}
                  >
                    {tasks.length}
                  </span>
                </div>
                <button
                  onClick={() => startAdd(key)}
                  title="Add task"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "background 0.1s, color 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = accent;
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                    e.currentTarget.style.borderColor = "var(--border)";
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", paddingLeft: 16 }}>
                {tag}
              </div>
            </div>

            {/* Task list */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px 10px 4px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {tasks.map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => setDragTaskId(task.id)}
                  onDragEnd={() => {
                    setDragTaskId(null);
                    setDragOverCol(null);
                  }}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "9px 11px",
                    cursor: dragTaskId === task.id ? "grabbing" : "grab",
                    opacity: dragTaskId === task.id ? 0.45 : 1,
                    transition: "opacity 0.1s",
                  }}
                >
                  {editingId === task.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmEdit(task);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          background: "var(--background)",
                          border: `1px solid ${accent}`,
                          borderRadius: 5,
                          color: "var(--foreground)",
                          fontSize: 13,
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ display: "flex", gap: 5 }}>
                        <button
                          onClick={() => confirmEdit(task)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            background: accent,
                            color: "#fff",
                            border: "none",
                            borderRadius: 5,
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            flex: 1,
                            padding: "4px",
                            background: "transparent",
                            border: "1px solid var(--border)",
                            borderRadius: 5,
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            fontSize: 12,
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: "var(--foreground)",
                          lineHeight: 1.45,
                          wordBreak: "break-word",
                        }}
                      >
                        {task.title}
                      </span>
                      <div style={{ display: "flex", gap: 2, flexShrink: 0, marginTop: 1 }}>
                        <button
                          onClick={() => startEdit(task)}
                          title="Edit"
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            borderRadius: 4,
                            fontSize: 13,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--surface-hover)";
                            e.currentTarget.style.color = "var(--foreground)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--text-muted)";
                          }}
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => onRemoveTask(task.id)}
                          title="Delete"
                          style={{
                            width: 22,
                            height: 22,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            borderRadius: 4,
                            fontSize: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#ef444418";
                            e.currentTarget.style.color = "#ef4444";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "var(--text-muted)";
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tasks.length === 0 && addingTo !== key && (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px 8px",
                    color: "var(--text-subtle)",
                    fontSize: 12,
                    fontStyle: "italic",
                  }}
                >
                  No tasks yet
                </div>
              )}
            </div>

            {/* Add task inline form */}
            <div style={{ padding: "8px 10px", flexShrink: 0 }}>
              {addingTo === key ? (
                <div>
                  <textarea
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Task title…"
                    autoFocus
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        confirmAdd(key);
                      }
                      if (e.key === "Escape") {
                        setAddingTo(null);
                        setNewTitle("");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      background: "var(--background)",
                      border: `1px solid ${accent}`,
                      borderRadius: 7,
                      color: "var(--foreground)",
                      fontSize: 13,
                      resize: "none",
                      outline: "none",
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      marginBottom: 6,
                    }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => confirmAdd(key)}
                      style={{
                        flex: 1,
                        padding: "6px",
                        background: accent,
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      Add task
                    </button>
                    <button
                      onClick={() => {
                        setAddingTo(null);
                        setNewTitle("");
                      }}
                      style={{
                        flex: 1,
                        padding: "6px",
                        background: "transparent",
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => startAdd(key)}
                  style={{
                    width: "100%",
                    padding: "7px",
                    background: "transparent",
                    border: "1px dashed var(--border)",
                    borderRadius: 7,
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    transition: "border-color 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accent;
                    e.currentTarget.style.color = accent;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }}
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
