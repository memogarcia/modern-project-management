"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatrixBoardMeta } from "@/lib/matrixTypes";
import { loadMatrixBoards, deleteMatrixBoard } from "@/lib/matrixStorage";
import { useMatrixStore } from "@/store/matrixStore";
import { KanbanSquare, Plus, Trash2 } from "lucide-react";

export default function KanbanListPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<MatrixBoardMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const initNewBoard = useMatrixStore((s) => s.initNewBoard);

  useEffect(() => {
    loadMatrixBoards().then(setBoards);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionError(null);
    try {
      const id = await initNewBoard(newName.trim());
      router.push(`/kanban/${id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create board");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this board?")) return;
    setActionError(null);
    try {
      await deleteMatrixBoard(id);
      setBoards(await loadMatrixBoards());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete board");
    }
  };

  return (
    <div style={{ flex: 1, background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ padding: "20px 40px", borderBottom: "1px solid var(--border)", background: "var(--panel-bg)", flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, letterSpacing: "-0.02em" }}>
              <KanbanSquare size={22} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
              Kanban Boards
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
              Visualize your matrix tasks as kanban columns.
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Plus size={16} />
            New Board
          </button>
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {actionError && (
            <div style={{ marginBottom: 16, padding: "10px 16px", background: "#ef444418", border: "1px solid #ef4444", borderRadius: 8, color: "#ef4444", fontSize: 13 }}>
              {actionError}
            </div>
          )}

          {showCreate && (
            <div style={{ marginBottom: 24, padding: 20, background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New kanban board</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Board name…"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    color: "var(--foreground)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
                <button
                  onClick={() => void handleCreate()}
                  style={{ padding: "8px 18px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ padding: "8px 14px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {boards.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
              <KanbanSquare size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No boards yet</div>
              <div style={{ fontSize: 14, marginBottom: 24 }}>
                Create a board to start organizing tasks in columns.
              </div>
              <button
                onClick={() => setShowCreate(true)}
                style={{ padding: "10px 24px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                + New Board
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {boards.map((board) => (
                <div
                  key={board.id}
                  onClick={() => router.push(`/kanban/${board.id}`)}
                  style={{
                    background: "var(--panel-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 20,
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)";
                    e.currentTarget.style.boxShadow = "var(--card-shadow-hover)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <KanbanSquare size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {board.name}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        Updated {new Date(board.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDelete(board.id); }}
                      title="Delete board"
                      style={{
                        width: 28,
                        height: 28,
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
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
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Column previews */}
                  <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
                    {(["do-first", "schedule", "delegate", "drop"] as const).map((q, i) => (
                      <div
                        key={q}
                        style={{
                          flex: 1,
                          height: 4,
                          borderRadius: 2,
                          background: ["#ef4444", "#f59e0b", "#3b82f6", "#6b7280"][i] + "60",
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
