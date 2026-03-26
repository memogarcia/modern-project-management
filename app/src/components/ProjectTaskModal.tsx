"use client";

import { useEffect, useState } from "react";
import type { ProjectDocument, ProjectTask } from "@/lib/ganttTypes";

type TaskDependencyInput = {
  dependsOnTaskId: string;
  type: ProjectTask["dependencies"][number]["type"];
};

type ProjectTaskDraft = {
  id?: string;
  epicId?: string | null;
  columnId?: string;
  name: string;
  description?: string;
  priority: ProjectTask["priority"];
  assignee?: string;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
  position?: number;
  color?: string | null;
  tags?: string[];
  links?: Array<Omit<ProjectTask["links"][number], "id">>;
  dependencies?: TaskDependencyInput[];
  metadata?: ProjectTask["metadata"];
};

type ProjectTaskModalProps = {
  open: boolean;
  project: ProjectDocument;
  task?: ProjectTask | null;
  onClose: () => void;
  onSave: (draft: ProjectTaskDraft) => Promise<void>;
};

const PRIORITY_OPTIONS: ProjectTask["priority"][] = ["critical", "high", "medium", "low"];
const DEPENDENCY_OPTIONS: TaskDependencyInput["type"][] = [
  "finish-to-start",
  "start-to-start",
  "finish-to-finish",
  "start-to-finish",
];

function buildInitialDependencies(task?: ProjectTask | null): TaskDependencyInput[] {
  if (!task) return [];
  return task.dependencies.map((dependency) => ({
    dependsOnTaskId: dependency.dependsOnTaskId,
    type: dependency.type,
  }));
}

export function ProjectTaskModal({
  open,
  project,
  task,
  onClose,
  onSave,
}: ProjectTaskModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [columnId, setColumnId] = useState(project.columns[0]?.id ?? "backlog");
  const [priority, setPriority] = useState<ProjectTask["priority"]>("medium");
  const [assignee, setAssignee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [progress, setProgress] = useState(0);
  const [color, setColor] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [isMilestone, setIsMilestone] = useState(false);
  const [dependencies, setDependencies] = useState<TaskDependencyInput[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(task?.name ?? "");
    setDescription(task?.description ?? "");
    setColumnId(task?.columnId ?? project.columns[0]?.id ?? "backlog");
    setPriority(task?.priority ?? "medium");
    setAssignee(task?.assignee ?? "");
    setStartDate(task?.startDate ?? "");
    setDueDate(task?.dueDate ?? "");
    setProgress(task?.progress ?? 0);
    setColor(task?.color ?? "");
    setTagsText(task?.tags.join(", ") ?? "");
    setIsMilestone(Boolean(task?.metadata.isMilestone));
    setDependencies(buildInitialDependencies(task));
    setError(null);
    setIsSaving(false);
  }, [open, project.columns, task]);

  if (!open) return null;

  const availableDependencyTasks = project.tasks.filter((entry) => entry.id !== task?.id);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Task name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        id: task?.id,
        epicId: task?.epicId ?? null,
        columnId,
        name: name.trim(),
        description: description.trim(),
        priority,
        assignee: assignee.trim(),
        startDate: startDate || null,
        dueDate: dueDate || null,
        progress,
        color: color || null,
        tags: tagsText
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
        links: [],
        dependencies: dependencies.filter((entry) => entry.dependsOnTaskId),
        metadata: {
          ...(task?.metadata ?? {}),
          isMilestone,
        },
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div
        className="edit-modal"
        style={{ maxWidth: 760, width: "min(92vw, 760px)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="edit-modal-header">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Project task
            </div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
              {task ? "Edit task" : "New task"}
            </div>
          </div>
          <button className="edit-modal-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>

        <div className="edit-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          {error && (
            <div
              role="alert"
              className="rounded-md border px-4 py-3 text-sm font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 24%, var(--border))",
                background: "color-mix(in srgb, var(--danger) 10%, var(--surface-raised))",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field md:col-span-2">
              <label className="edit-modal-label">Task name</label>
              <input
                className="edit-modal-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Launch beta pilot"
                autoFocus
              />
            </div>

            <div className="edit-modal-field md:col-span-2">
              <label className="edit-modal-label">Description</label>
              <textarea
                className="edit-modal-input"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What outcome this task should deliver."
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Status</label>
              <select
                className="edit-modal-input"
                value={columnId}
                onChange={(event) => setColumnId(event.target.value)}
              >
                {project.columns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Priority</label>
              <select
                className="edit-modal-input"
                value={priority}
                onChange={(event) => setPriority(event.target.value as ProjectTask["priority"])}
              >
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Owner</label>
              <input
                className="edit-modal-input"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                placeholder="Design team"
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Task color</label>
              <input
                className="edit-modal-input"
                type="color"
                value={color || "#4262ff"}
                onChange={(event) => setColor(event.target.value)}
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Start date</label>
              <input
                className="edit-modal-input"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Due date</label>
              <input
                className="edit-modal-input"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Progress</label>
              <input
                className="edit-modal-input"
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(event) => setProgress(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
              />
            </div>

            <div className="edit-modal-field">
              <label className="edit-modal-label">Tags</label>
              <input
                className="edit-modal-input"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                placeholder="beta, launch, ops"
              />
            </div>

            <div className="edit-modal-field md:col-span-2">
              <label className="edit-modal-label">Milestone</label>
              <label className="edit-modal-toggle">
                <input
                  type="checkbox"
                  checked={isMilestone}
                  onChange={(event) => setIsMilestone(event.target.checked)}
                />
                <span className="edit-modal-toggle-slider" />
              </label>
            </div>

            <div className="edit-modal-field md:col-span-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="edit-modal-label">Dependencies</label>
                <button
                  type="button"
                  className="edit-modal-btn edit-modal-btn-secondary"
                  onClick={() =>
                    setDependencies((entries) => [
                      ...entries,
                      { dependsOnTaskId: availableDependencyTasks[0]?.id ?? "", type: "finish-to-start" },
                    ])
                  }
                  disabled={availableDependencyTasks.length === 0}
                >
                  Add dependency
                </button>
              </div>

              {dependencies.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--border)] px-4 py-3 text-sm text-[var(--text-muted)]">
                  No predecessors yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {dependencies.map((dependency, index) => (
                    <div key={`${dependency.dependsOnTaskId}-${index}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_110px]">
                      <select
                        className="edit-modal-input"
                        value={dependency.dependsOnTaskId}
                        onChange={(event) =>
                          setDependencies((entries) =>
                            entries.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, dependsOnTaskId: event.target.value }
                                : entry
                            )
                          )
                        }
                      >
                        <option value="">Select predecessor</option>
                        {availableDependencyTasks.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.name}
                          </option>
                        ))}
                      </select>

                      <select
                        className="edit-modal-input"
                        value={dependency.type}
                        onChange={(event) =>
                          setDependencies((entries) =>
                            entries.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, type: event.target.value as TaskDependencyInput["type"] }
                                : entry
                            )
                          )
                        }
                      >
                        {DEPENDENCY_OPTIONS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="edit-modal-btn edit-modal-btn-secondary"
                        onClick={() =>
                          setDependencies((entries) => entries.filter((_, entryIndex) => entryIndex !== index))
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="edit-modal-footer">
          <button className="edit-modal-btn edit-modal-btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button className="edit-modal-btn edit-modal-btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : task ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </div>
  );
}
