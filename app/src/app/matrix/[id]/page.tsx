"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMatrixStore } from "@/store/matrixStore";
import KanbanBoard from "@/components/KanbanBoard";
import type { MatrixQuadrant } from "@/lib/matrixTypes";
import { ListTree, KanbanSquare, Grid2x2, AlertCircle, Plus } from "lucide-react";

type PageView = "matrix" | "kanban";

const QUADRANTS: { key: MatrixQuadrant; label: string; tag: string; accent: string }[] = [
  { key: "do-first", label: "Do First", tag: "Urgent · Important", accent: "#ef4444" },
  { key: "schedule", label: "Schedule", tag: "Not Urgent · Important", accent: "#f59e0b" },
  { key: "delegate", label: "Delegate", tag: "Urgent · Not Important", accent: "#3b82f6" },
  { key: "drop", label: "Drop", tag: "Not Urgent · Not Important", accent: "#6b7280" },
];

export default function MatrixDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const board = useMatrixStore((s) => s.board);
  const loadError = useMatrixStore((s) => s.loadError);
  const isLoading = useMatrixStore((s) => s.isLoading);
  const persistError = useMatrixStore((s) => s.persistError);
  const loadBoard = useMatrixStore((s) => s.loadBoard);
  const addTask = useMatrixStore((s) => s.addTask);
  const updateTask = useMatrixStore((s) => s.updateTask);
  const removeTask = useMatrixStore((s) => s.removeTask);
  const updateMeta = useMatrixStore((s) => s.updateMeta);

  const [pageView, setPageView] = useState<PageView>(
    (searchParams.get("view") as PageView) === "kanban" ? "kanban" : "matrix"
  );
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  // Inline add for matrix quadrant view
  const [addingTo, setAddingTo] = useState<MatrixQuadrant | null>(null);
  const [addTitle, setAddTitle] = useState("");

  useEffect(() => {
    void loadBoard(id);
  }, [id, loadBoard]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)" }}>
        Loading board…
      </div>
    );
  }

  if (!board) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)", gap: 16 }}>
        <AlertCircle size={48} style={{ opacity: 0.4 }} />
        <div>{loadError ?? "Board not found"}</div>
        <button
          onClick={() => router.push("/matrix")}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          ← Back to boards
        </button>
      </div>
    );
  }

  const handleAddTask = (title: string, quadrant: MatrixQuadrant) => {
    addTask(title, quadrant);
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--background)", color: "var(--foreground)", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-bg)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push("/matrix")}
          style={{ padding: "6px 10px", background: "transparent", color: "var(--text-muted)", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          Matrix Boards
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
                padding: "4px 10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--foreground)",
                fontSize: 14,
                fontWeight: 700,
                outline: "none",
                width: 240,
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
            onClick={() => { setNameInput(board.name); setEditingName(true); }}
            title="Click to rename"
          >
            <ListTree size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{board.name}</span>
          </div>
        )}

        {persistError && (
          <span style={{ fontSize: 11, color: "#ef4444", padding: "3px 8px", background: "#ef444418", borderRadius: 6 }}>
            Save failed
          </span>
        )}

        {/* View toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
          {(["matrix", "kanban"] as PageView[]).map((v) => (
            <button
              key={v}
              onClick={() => setPageView(v)}
              style={{
                padding: "6px 14px",
                background: pageView === v ? "var(--accent)" : "var(--surface)",
                color: pageView === v ? "var(--accent-foreground)" : "var(--text-muted)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {v === "matrix" ? (
                <><Grid2x2 size={13} /> Matrix</>
              ) : (
                <><KanbanSquare size={13} /> Kanban</>
              )}
            </button>
          ))}
        </div>

        {/* Task count badge */}
        <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "3px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20 }}>
          {board.tasks.length} {board.tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 20 }}>
        {pageView === "kanban" ? (
          <KanbanBoard
            board={board}
            onAddTask={handleAddTask}
            onUpdateTask={updateTask}
            onRemoveTask={removeTask}
          />
        ) : (
          /* Matrix quadrant grid view */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 14, flex: 1, minHeight: 0 }}>
            {QUADRANTS.map(({ key, label, tag, accent }) => {
              const tasks = board.tasks.filter((t) => t.quadrant === key);
              return (
                <div
                  key={key}
                  style={{
                    background: "var(--panel-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  {/* Quadrant header */}
                  <div style={{ padding: "12px 16px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: accent, display: "inline-block" }} />
                        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>{label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", background: `${accent}18`, padding: "1px 7px", borderRadius: 20 }}>
                          {tasks.length}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface-hover)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 20 }}>
                        {tag}
                      </span>
                    </div>
                  </div>

                  {/* Task list */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          marginBottom: 4,
                          borderRadius: 6,
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          fontSize: 13,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {task.title}
                        </span>
                        <button
                          onClick={() => removeTask(task.id)}
                          title="Delete"
                          style={{
                            width: 20,
                            height: 20,
                            padding: 0,
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            borderRadius: 4,
                            fontSize: 15,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {tasks.length === 0 && addingTo !== key && (
                      <p style={{ fontSize: 12, color: "var(--text-subtle)", fontStyle: "italic", margin: "4px 0" }}>No tasks yet</p>
                    )}
                  </div>

                  {/* Add task */}
                  <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
                    {addingTo === key ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={addTitle}
                          onChange={(e) => setAddTitle(e.target.value)}
                          placeholder="Task title…"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && addTitle.trim()) {
                              addTask(addTitle.trim(), key);
                              setAddTitle("");
                              setAddingTo(null);
                            }
                            if (e.key === "Escape") setAddingTo(null);
                          }}
                          style={{
                            flex: 1,
                            padding: "5px 8px",
                            background: "var(--background)",
                            border: `1px solid ${accent}`,
                            borderRadius: 5,
                            color: "var(--foreground)",
                            fontSize: 12,
                            outline: "none",
                          }}
                        />
                        <button
                          onClick={() => {
                            if (addTitle.trim()) { addTask(addTitle.trim(), key); setAddTitle(""); setAddingTo(null); }
                          }}
                          style={{ padding: "5px 10px", background: accent, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddingTo(null)}
                          style={{ padding: "5px 8px", background: "transparent", border: "1px solid var(--border)", borderRadius: 5, cursor: "pointer", color: "var(--text-muted)", fontSize: 12 }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(key); setAddTitle(""); }}
                        style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 4, padding: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = accent; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                      >
                        <Plus size={13} /> Add task
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
