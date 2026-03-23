"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DiagramMeta } from "@/lib/types";
import { loadDiagrams, deleteDiagram, saveDiagram } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2, ArrowLeft, FileText } from "lucide-react";

export default function DiagramsListPage() {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    loadDiagrams().then(setDiagrams);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionError(null);
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      await saveDiagram({
        id,
        name: newName.trim(),
        description: newDesc.trim(),
        projectId: null,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        nodeCount: 0,
        edgeCount: 0,
        sessionCount: 0,
        openSessionCount: 0,
        nodes: [],
        edges: [],
        mermaidCode: "graph TD\n",
      });
      router.push(`/diagrams/${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create diagram";
      setActionError(message);
      console.error("Failed to create diagram", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diagram?")) return;
    setActionError(null);
    try {
      await deleteDiagram(id);
      const updated = await loadDiagrams();
      setDiagrams(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete diagram";
      setActionError(message);
      console.error("Failed to delete diagram", error);
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--background)",
        color: "var(--foreground)",
        overflow: "hidden",
      }}
    >
      {/* Top header bar — aligned with sidebar header */}
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0">
        <span className="text-sm font-semibold text-[var(--foreground)]">Diagrams</span>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

      {actionError && (
        <div
          role="alert"
          style={{
            padding: "10px 40px",
            borderBottom: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--danger) 10%, var(--panel-bg))",
            color: "var(--danger)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {actionError}
        </div>
      )}

      {/* Modern Create modal */}
      {showCreate && (
        <div
          className="edit-modal-overlay"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="edit-modal"
            style={{ width: "480px", maxWidth: "90vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="edit-modal-header">
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600, letterSpacing: "-0.01em" }}>
                Create New Diagram
              </h2>
              <button
                className="edit-modal-close"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="edit-modal-body">
              <div className="edit-modal-field">
                <label className="edit-modal-label">Name</label>
                <input
                  className="edit-modal-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Microservices Architecture"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              <div className="edit-modal-field">
                <label className="edit-modal-label">Description (optional)</label>
                <input
                  className="edit-modal-input"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of your diagram..."
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
            </div>
            <div className="edit-modal-footer">
              <button
                className="edit-modal-btn edit-modal-btn-secondary"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button
                className="edit-modal-btn edit-modal-btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create Diagram
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diagram content */}
      <main style={{ padding: "32px 40px", maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em", display: "flex", alignItems: "center", gap: 10 }}>
              <FileText size={20} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
              All Diagrams
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Architecture diagrams with React Flow & Mermaid
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "8px 16px",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            New Diagram
          </button>
        </div>
        {diagrams.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "120px 20px",
              color: "var(--text-muted)",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 20px",
                background: "var(--surface)",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              <FileText size={32} strokeWidth={1.5} style={{ color: "var(--text-subtle)" }} />
            </div>
            <h3 style={{ fontSize: "18px", marginBottom: "8px", fontWeight: 600, color: "var(--foreground)" }}>
              No diagrams yet
            </h3>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: 24 }}>
              Create your first architecture diagram to get started
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: "10px 20px",
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
              Create Diagram
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "20px",
            }}
          >
            {diagrams.map((d) => (
              <div
                key={d.id}
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "24px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "var(--card-shadow)",
                  position: "relative",
                }}
                onClick={() => router.push(`/diagrams/${d.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "var(--card-shadow-hover)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "var(--card-shadow)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "16px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: "var(--foreground)",
                      flex: 1,
                    }}
                  >
                    {d.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(d.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-subtle)",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.15s ease",
                      marginLeft: 8,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--danger)" + "15";
                      e.currentTarget.style.color = "var(--danger)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-subtle)";
                    }}
                    title="Delete diagram"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {d.description && (
                  <p
                    style={{
                      margin: "0 0 16px",
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {d.description}
                  </p>
                )}
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text-subtle)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Updated{" "}
                  {new Date(d.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      </div>
    </div>
  );
}
