"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KanbanProjectMeta } from "@/lib/projectTypes";
import { loadProjects, deleteProject } from "@/lib/projectStorage";
import { useProjectStore } from "@/store/projectStore";
import { KanbanSquare, Plus, Trash2, Layers, Calendar, BarChart3, Grid3X3, Timer } from "lucide-react";

export default function ProjectsListPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<(KanbanProjectMeta & { epicCount?: number; taskCount?: number; columnCount?: number })[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const initNewProject = useProjectStore((s) => s.initNewProject);

  useEffect(() => {
    loadProjects().then(setProjects);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setActionError(null);
    try {
      const id = await initNewProject(newName.trim(), newDesc.trim() || undefined);
      router.push(`/projects/${id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project and all its data?")) return;
    setActionError(null);
    try {
      await deleteProject(id);
      setProjects(await loadProjects());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  return (
    <div style={{ flex: 1, background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header style={{ padding: "20px 40px", borderBottom: "1px solid var(--border)", background: "var(--panel-bg)", flexShrink: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, letterSpacing: "-0.02em" }}>
              <Layers size={22} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
              Projects
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--text-muted)" }}>
              Unified task management — Kanban · Gantt · Calendar · Matrix · Sessions
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "10px 20px", background: "var(--accent)", color: "var(--accent-foreground)",
              border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 8,
            }}
          >
            <Plus size={16} />
            New Project
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
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New project</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name…"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  style={{
                    padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 7, color: "var(--foreground)", fontSize: 14, outline: "none",
                  }}
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  style={{
                    padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 7, color: "var(--foreground)", fontSize: 13, outline: "none",
                  }}
                />
                <div style={{ display: "flex", gap: 10 }}>
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
            </div>
          )}

          {projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-muted)" }}>
              <Layers size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No projects yet</div>
              <div style={{ fontSize: 14, marginBottom: 24 }}>
                Create a project to start managing tasks across Kanban, Gantt, Calendar, Matrix, and Sessions views.
              </div>
              <button
                onClick={() => setShowCreate(true)}
                style={{ padding: "10px 24px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                + New Project
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  style={{
                    background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: 20, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "var(--card-shadow-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <Layers size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.name}
                        </span>
                      </div>
                      {project.description && (
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {project.description}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-muted)" }}>
                        {project.epicCount !== undefined && <span>{project.epicCount} epics</span>}
                        {project.taskCount !== undefined && <span>· {project.taskCount} tasks</span>}
                        <span>· Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleDelete(project.id); }}
                      title="Delete project"
                      style={{
                        width: 28, height: 28, background: "transparent", border: "none",
                        color: "var(--text-muted)", cursor: "pointer", borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#ef444418"; e.currentTarget.style.color = "#ef4444"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* View icons */}
                  <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                    {[
                      { icon: KanbanSquare, label: "Kanban", color: "#3b82f6" },
                      { icon: BarChart3, label: "Gantt", color: "#f59e0b" },
                      { icon: Calendar, label: "Calendar", color: "#22c55e" },
                      { icon: Grid3X3, label: "Matrix", color: "#8b5cf6" },
                      { icon: Timer, label: "Sessions", color: "#06b6d4" },
                    ].map(({ icon: Icon, label, color }) => (
                      <div
                        key={label}
                        title={label}
                        style={{
                          width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center",
                          justifyContent: "center", background: `${color}10`, color,
                        }}
                      >
                        <Icon size={13} />
                      </div>
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
