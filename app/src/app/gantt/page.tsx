"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { GanttChartMeta } from "@/lib/ganttTypes";
import { loadGanttCharts, deleteGanttChart } from "@/lib/ganttStorage";
import { useGanttStore } from "@/store/ganttStore";
import { Plus, Trash2, ArrowLeft, Calendar } from "lucide-react";

export default function GanttListPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<GanttChartMeta[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const initNewChart = useGanttStore((s) => s.initNewChart);

  useEffect(() => {
    loadGanttCharts().then(setCharts);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await initNewChart(newName.trim(), newDesc.trim());
    router.push(`/gantt/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this Gantt chart?")) return;
    await deleteGanttChart(id);
    const updated = await loadGanttCharts();
    setCharts(updated);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Modern Header */}
      <header
        style={{
          padding: "20px 40px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-bg)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <button
              onClick={() => router.push("/")}
              style={{
                padding: "8px 16px",
                background: "var(--surface)",
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-hover)";
                e.currentTarget.style.borderColor = "var(--panel-border)";
                e.currentTarget.style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <ArrowLeft size={14} /> Home
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, letterSpacing: "-0.02em" }}>
                <Calendar size={24} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
                Gantt Charts
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)", fontWeight: 400 }}>
                Project planning with tasks, timelines & integrations
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px",
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "0 2px 8px rgba(94, 106, 210, 0.25)",
              transition: "all 0.15s ease",
              letterSpacing: "-0.01em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--accent-hover)";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(94, 106, 210, 0.35)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--accent)";
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(94, 106, 210, 0.25)";
            }}
          >
            <Plus size={18} strokeWidth={2.5} />
            New Gantt Chart
          </button>
        </div>
      </header>

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
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Create New Gantt Chart</h2>
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
                  placeholder="e.g. Q1 Sprint Plan"
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
                  placeholder="Brief description of your project..."
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
                Create Chart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Chart Grid */}
      <main style={{ padding: "32px 40px", maxWidth: 1400, margin: "0 auto" }}>
        {charts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "120px 20px", color: "var(--text-muted)" }}>
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
              <Calendar size={32} strokeWidth={1.5} style={{ color: "var(--text-subtle)" }} />
            </div>
            <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 600, color: "var(--foreground)" }}>No Gantt charts yet</h3>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
              Create your first project timeline to get started
            </p>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                padding: "10px 20px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Plus size={18} strokeWidth={2.5} />
              Create Gantt Chart
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {charts.map((c) => (
              <div
                key={c.id}
                style={{
                  background: "var(--panel-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: 24,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: "var(--card-shadow)",
                  position: "relative",
                }}
                onClick={() => router.push(`/gantt/${c.id}`)}
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em", flex: 1 }}>
                    <Calendar size={18} style={{ color: "var(--accent)" }} />
                    {c.name}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(c.id);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-subtle)",
                      cursor: "pointer",
                      padding: 6,
                      borderRadius: 6,
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
                    title="Delete chart"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {c.description && (
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {c.description}
                  </p>
                )}
                <div style={{ fontSize: 12, color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: 4 }}>
                  Updated{" "}
                  {new Date(c.updatedAt).toLocaleDateString("en-US", {
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
  );
}
