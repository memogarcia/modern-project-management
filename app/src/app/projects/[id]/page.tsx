"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronLeft,
  Milestone,
  Pencil,
  Plus,
  Route,
  Target,
  Trash2,
} from "lucide-react";
import { ProjectGantt, type GanttZoom } from "@/components/ProjectGantt";
import { ProjectTaskModal } from "@/components/ProjectTaskModal";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import type { ProjectDocument, ProjectTask } from "@/lib/ganttTypes";
import {
  deleteProject,
  deleteProjectTask,
  loadProject,
  saveProjectTask,
  updateProject,
} from "@/lib/ganttStorage";

function formatDate(value?: string | null): string {
  if (!value) return "Unscheduled";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [zoom, setZoom] = useState<GanttZoom>("months");
  const [actionError, setActionError] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");

  useEffect(() => {
    void params.then((resolved) => setProjectId(resolved.id));
  }, [params]);

  const projectQuery = useAsyncResource<ProjectDocument | null>(
    () => (projectId ? loadProject(projectId) : Promise.resolve(null)),
    [projectId],
    null
  );

  const project = projectQuery.data;
  const selectedTask =
    project?.tasks.find((task) => task.id === selectedTaskId) ??
    project?.tasks.find((task) => task.startDate && task.dueDate) ??
    project?.tasks[0] ??
    null;

  useEffect(() => {
    if (!project) return;
    if (selectedTaskId && project.tasks.some((task) => task.id === selectedTaskId)) return;
    const fallbackTask = project.tasks.find((task) => task.startDate && task.dueDate) ?? project.tasks[0];
    setSelectedTaskId(fallbackTask?.id ?? null);
  }, [project, selectedTaskId]);

  useEffect(() => {
    if (!project || !showProjectModal) return;
    setProjectName(project.name);
    setProjectDescription(project.description);
  }, [project, showProjectModal]);

  const handleSaveTask = async (
    draft: Parameters<typeof saveProjectTask>[1]
  ) => {
    if (!projectId) return;
    setActionError(null);
    const saved = await saveProjectTask(projectId, draft);
    await projectQuery.refresh();
    setSelectedTaskId(saved.id);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!projectId || !confirm("Delete this task?")) return;
    setActionError(null);
    try {
      await deleteProjectTask(projectId, taskId);
      await projectQuery.refresh();
      setSelectedTaskId((current) => (current === taskId ? null : current));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete task");
    }
  };

  const handleSaveProject = async () => {
    if (!projectId || !projectName.trim()) return;
    setActionError(null);
    try {
      await updateProject(projectId, {
        name: projectName.trim(),
        description: projectDescription.trim(),
      });
      await projectQuery.refresh();
      setShowProjectModal(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update project");
    }
  };

  const handleDeleteProject = async () => {
    if (!projectId || !confirm("Delete this project and all of its tasks?")) return;
    setActionError(null);
    try {
      await deleteProject(projectId);
      router.push("/projects");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete project");
    }
  };

  if (projectQuery.isLoading && !project) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--background)] text-[var(--text-muted)]">
        <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-[var(--accent)] border-r-transparent" />
      </div>
    );
  }

  if (!projectId || !project) {
    return (
      <div className="workspace-page">
        <div className="flex h-[72px] shrink-0 items-center border-b border-[var(--panel-border)] px-6">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]"
            onClick={() => router.push("/projects")}
          >
            <ChevronLeft size={16} />
            Back to projects
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-md rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-8 py-10 text-center">
            <div className="text-lg font-semibold text-[var(--foreground)]">Project not found</div>
            <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
              This roadmap does not exist or could not be loaded from the shared workspace.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedDependencies = selectedTask?.dependencies
    .map((dependency) => {
      const predecessor = project.tasks.find((task) => task.id === dependency.dependsOnTaskId);
      return predecessor ? `${predecessor.name} (${dependency.type})` : null;
    })
    .filter((value): value is string => Boolean(value)) ?? [];

  return (
    <div className="workspace-page">
      <div className="flex min-h-[88px] shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--panel-border)] px-6 py-4">
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--foreground)]"
            onClick={() => router.push("/projects")}
          >
            <ChevronLeft size={16} />
            Back to projects
          </button>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
            Project roadmap
          </div>
          <div className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
            {project.name}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
            {project.description || "A dependency-aware Gantt view backed by the shared PlanView workspace."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
            onClick={() => setShowProjectModal(true)}
          >
            <Pencil size={16} />
            Edit project
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] transition-colors hover:bg-[var(--accent-hover)]"
            onClick={() => {
              setEditingTask(null);
              setShowTaskModal(true);
            }}
          >
            <Plus size={16} />
            New task
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
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

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="floating-panel rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <CalendarClock size={14} />
                Scheduled
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {project.scheduledTaskCount}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">Tasks currently on the timeline</div>
            </div>

            <div className="floating-panel rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Route size={14} />
                Dependencies
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {project.dependencyCount}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">Typed task relationships</div>
            </div>

            <div className="floating-panel rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Milestone size={14} />
                Milestones
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {project.tasks.filter((task) => Boolean(task.metadata.isMilestone)).length}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">Timeline checkpoints</div>
            </div>

            <div className="floating-panel rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Target size={14} />
                Linked context
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                {project.openSessionCount}
              </div>
              <div className="mt-1 text-sm text-[var(--text-muted)]">
                Open investigations across {project.diagramCount} project diagrams
              </div>
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <ProjectGantt
              project={project}
              selectedTaskId={selectedTask?.id ?? null}
              zoom={zoom}
              onSelectTask={setSelectedTaskId}
              onZoomChange={setZoom}
            />

            <aside className="floating-panel rounded-lg border border-[var(--panel-border)] px-5 py-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Selected task
              </div>

              {selectedTask ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                      {selectedTask.name}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                      {selectedTask.description || "No task description yet."}
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                        Schedule
                      </div>
                      <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                        {formatDate(selectedTask.startDate)} to {formatDate(selectedTask.dueDate)}
                      </div>
                    </div>

                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                        Owner
                      </div>
                      <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                        {selectedTask.assignee || "Unassigned"}
                      </div>
                    </div>

                    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-subtle)]">
                        Progress
                      </div>
                      <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                        {selectedTask.progress}% complete
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Dependencies
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedDependencies.length > 0 ? (
                        selectedDependencies.map((dependency) => (
                          <div key={dependency} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
                            {dependency}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-3 text-sm text-[var(--text-muted)]">
                          No predecessors configured.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      Tags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedTask.tags.length > 0 ? (
                        selectedTask.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--text-muted)]"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[var(--text-muted)]">No tags</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-hover)]"
                      onClick={() => {
                        setEditingTask(selectedTask);
                        setShowTaskModal(true);
                      }}
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-transparent bg-[color:color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-4 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--danger)_18%,var(--surface))]"
                      onClick={() => void handleDeleteTask(selectedTask.id)}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-md border border-dashed border-[var(--border)] px-4 py-5 text-sm text-[var(--text-muted)]">
                  Select a task to inspect its schedule, progress, and predecessor links.
                </div>
              )}

              <div className="mt-6 border-t border-[var(--panel-border)] pt-5">
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-transparent bg-[color:color-mix(in_srgb,var(--danger)_12%,var(--surface))] px-4 text-sm font-medium text-[var(--danger)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--danger)_18%,var(--surface))]"
                  onClick={() => void handleDeleteProject()}
                >
                  <Trash2 size={16} />
                  Delete project
                </button>
              </div>
            </aside>
          </section>
        </div>
      </div>

      <ProjectTaskModal
        open={showTaskModal}
        project={project}
        task={editingTask}
        onClose={() => {
          setShowTaskModal(false);
          setEditingTask(null);
        }}
        onSave={handleSaveTask}
      />

      {showProjectModal && (
        <div className="edit-modal-overlay" onClick={() => setShowProjectModal(false)}>
          <div
            className="edit-modal"
            style={{ width: "520px", maxWidth: "92vw" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="edit-modal-header">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Project settings
                </div>
                <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                  Update roadmap details
                </div>
              </div>
              <button className="edit-modal-close" onClick={() => setShowProjectModal(false)} aria-label="Close">
                x
              </button>
            </div>

            <div className="edit-modal-body">
              <div className="edit-modal-field">
                <label className="edit-modal-label">Project name</label>
                <input
                  className="edit-modal-input"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  autoFocus
                />
              </div>

              <div className="edit-modal-field">
                <label className="edit-modal-label">Description</label>
                <textarea
                  className="edit-modal-input"
                  rows={3}
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                />
              </div>
            </div>

            <div className="edit-modal-footer">
              <button className="edit-modal-btn edit-modal-btn-secondary" onClick={() => setShowProjectModal(false)}>
                Cancel
              </button>
              <button className="edit-modal-btn edit-modal-btn-primary" onClick={() => void handleSaveProject()}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
