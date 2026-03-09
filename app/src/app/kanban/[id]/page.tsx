"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMatrixStore } from "@/store/matrixStore";
import KanbanBoard from "@/components/KanbanBoard";
import type { MatrixQuadrant } from "@/lib/matrixTypes";
import { KanbanSquare, AlertCircle, ListTree } from "lucide-react";

export default function KanbanDetailPage() {
  const params = useParams();
  const router = useRouter();
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

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

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
          onClick={() => router.push("/kanban")}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          ← Back to boards
        </button>
      </div>
    );
  }

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
          onClick={() => router.push("/kanban")}
          style={{ padding: "6px 10px", background: "transparent", color: "var(--text-muted)", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          Kanban Boards
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
            <KanbanSquare size={16} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: 15, fontWeight: 700 }}>{board.name}</span>
          </div>
        )}

        {persistError && (
          <span style={{ fontSize: 11, color: "#ef4444", padding: "3px 8px", background: "#ef444418", borderRadius: 6 }}>
            Save failed
          </span>
        )}

        {/* Also accessible as Matrix view */}
        <button
          onClick={() => router.push(`/matrix/${id}`)}
          title="View as Eisenhower Matrix"
          style={{
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-muted)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            transition: "border-color 0.15s, color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--foreground)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <ListTree size={13} /> Matrix view
        </button>

        <span style={{ fontSize: 12, color: "var(--text-muted)", padding: "3px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20 }}>
          {board.tasks.length} {board.tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Kanban board */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: 20 }}>
        <KanbanBoard
          board={board}
          onAddTask={(title: string, quadrant: MatrixQuadrant) => addTask(title, quadrant)}
          onUpdateTask={updateTask}
          onRemoveTask={removeTask}
        />
      </div>
    </div>
  );
}
