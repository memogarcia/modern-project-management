"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Flag, FolderKanban, Plus, Route, Trash2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { createProject, deleteProject } from "@/lib/ganttStorage";

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ProjectsPage() {
  const router = useRouter();
  const projectsQuery = useProjects();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setActionError(null);
    try {
      const project = await createProject({
        name: newName.trim(),
        description: newDescription.trim(),
      });
      await projectsQuery.refresh();
      router.push(`/projects/${project.id}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create project");
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm("Delete this project and all of its tasks?")) return;
    setActionError(null);
    try {
      await deleteProject(projectId);
      await projectsQuery.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  return (
    <div className="workspace-page">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Workspace
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Projects
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_1px_3px_rgba(66,98,255,0.18)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus size={18} />
          New project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          {actionError && (
            <div
              role="alert"
              className="rounded-md border px-4 py-3 text-sm font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 24%, var(--border))",
                background: "color-mix(in srgb, var(--danger) 10%, var(--surface-raised))",
                color: "var(--danger)",
              }}
            >
              {actionError}
            </div>
          )}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="floating-panel rounded-lg px-6 py-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  <CalendarRange size={14} className="text-[var(--accent)]" />
                  Project timelines
                </div>
                <h1 className="mt-4 text-[clamp(2rem,3vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Keep one project roadmap, one dependency map, and one source of truth for dates.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
                  Build project-based Gantt plans with typed dependencies, progress tracking, and milestone markers on the same SQLite-backed workspace your MCP agents can edit.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Projects
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {projectsQuery.data.length}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Tasks
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {projectsQuery.data.reduce((sum, project) => sum + project.taskCount, 0)} scheduled
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Dependencies
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {projectsQuery.data.reduce((sum, project) => sum + project.dependencyCount, 0)} active links
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-panel rounded-lg px-5 py-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Best practice baseline
              </div>
              <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Roadmaps that stay readable
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Plan per project, not per portfolio, so dependencies stay legible.",
                  "Use milestones and typed predecessor links instead of free-form notes.",
                  "Keep unscheduled work visible but off the main timeline until dates are real.",
                ].map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                      {index + 1}
                    </div>
                    <div className="text-sm leading-6 text-[var(--text-muted)]">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {projectsQuery.data.length === 0 ? (
            <section className="floating-panel flex flex-col items-center rounded-lg px-8 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <FolderKanban size={34} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                No project roadmaps yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-[var(--text-muted)]">
                Create a project to start mapping tasks across a dependency-aware Gantt view with MCP access.
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_1px_3px_rgba(66,98,255,0.18)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <Plus size={18} />
                Create project
              </button>
            </section>
          ) : (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {projectsQuery.data.map((project) => (
                <article
                  key={project.id}
                  className="group floating-panel cursor-pointer rounded-lg p-4 transition-transform duration-150 hover:-translate-y-0.5"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                        <Route size={14} />
                        {project.dependencyCount} links
                      </div>

                      <button
                        type="button"
                        title="Delete project"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface))] hover:text-[var(--danger)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(project.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4">
                      <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                        {project.name}
                      </h2>
                      <p className="mt-1 line-clamp-2 min-h-[42px] text-sm leading-6 text-[var(--text-muted)]">
                        {project.description || "Track milestones, typed dependencies, and progress on a single project timeline."}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-md border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                          Tasks
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{project.taskCount}</div>
                      </div>
                      <div className="rounded-md border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                          Done
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{project.completedTaskCount}</div>
                      </div>
                      <div className="rounded-md border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                          Risks
                        </div>
                        <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{project.overdueTaskCount}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Updated {formatUpdatedAt(project.updatedAt)}
                      </span>
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {project.scheduledTaskCount} scheduled
                      </span>
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {project.openSessionCount} investigations
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="edit-modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="edit-modal"
            style={{ width: "520px", maxWidth: "92vw" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="edit-modal-header">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  New project
                </div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  Start a roadmap
                </div>
              </div>
              <button className="edit-modal-close" onClick={() => setShowCreate(false)} aria-label="Close">
                x
              </button>
            </div>

            <div className="edit-modal-body">
              <div className="edit-modal-field">
                <label className="edit-modal-label">Project name</label>
                <input
                  className="edit-modal-input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Spring launch"
                  autoFocus
                />
              </div>

              <div className="edit-modal-field">
                <label className="edit-modal-label">Description</label>
                <textarea
                  className="edit-modal-input"
                  rows={3}
                  value={newDescription}
                  onChange={(event) => setNewDescription(event.target.value)}
                  placeholder="What this project is shipping or changing."
                />
              </div>
            </div>

            <div className="edit-modal-footer">
              <button className="edit-modal-btn edit-modal-btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="edit-modal-btn edit-modal-btn-primary" onClick={handleCreate}>
                Create project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
