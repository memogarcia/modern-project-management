"use client";

import { useEffect, useRef, useState } from "react";
import type { KanbanProject, KanbanTaskPriority } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";
import { X, Plus, Sparkles } from "lucide-react";
import { IconButton } from "./ui/icon-button";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────

export type CreateItemMode = "task" | "epic";

export interface CreateItemDefaults {
  columnId?: string;
  epicId?: string;
  priority?: KanbanTaskPriority;
  startDate?: string;
  dueDate?: string;
}

export interface CreateItemModalProps {
  project: KanbanProject;
  mode: CreateItemMode;
  defaults?: CreateItemDefaults;
  onClose: () => void;
  onCreateTask: (task: {
    epicId: string;
    columnId: string;
    name: string;
    description?: string;
    priority?: KanbanTaskPriority;
    assignee?: string;
    tags?: string[];
    startDate?: string;
    dueDate?: string;
  }) => void;
  onCreateEpic: (name: string, description?: string, color?: string) => void;
}

// ─── Preset colors for epics ─────────────────────────────────────────

const EPIC_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
  "#22c55e", "#06b6d4", "#ef4444", "#6b7280",
];

// ─── Component ───────────────────────────────────────────────────────

export default function CreateItemModal({
  project,
  mode: initialMode,
  defaults,
  onClose,
  onCreateTask,
  onCreateEpic,
}: CreateItemModalProps) {
  const [mode, setMode] = useState<CreateItemMode>(initialMode);

  // Task fields
  const [taskName, setTaskName] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskEpicId, setTaskEpicId] = useState(defaults?.epicId ?? project.epics[0]?.id ?? "");
  const [taskColumnId, setTaskColumnId] = useState(
    defaults?.columnId ?? project.columns.sort((a, b) => a.position - b.position)[0]?.id ?? ""
  );
  const [taskPriority, setTaskPriority] = useState<KanbanTaskPriority>(defaults?.priority ?? "medium");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskStartDate, setTaskStartDate] = useState(defaults?.startDate ?? "");
  const [taskDueDate, setTaskDueDate] = useState(defaults?.dueDate ?? "");

  // Epic fields
  const [epicName, setEpicName] = useState("");
  const [epicDescription, setEpicDescription] = useState("");
  const [epicColor, setEpicColor] = useState(EPIC_COLORS[0]);

  const backdropRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [mode]);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleSubmit = () => {
    if (mode === "task") {
      if (!taskName.trim()) return;
      let epicId = taskEpicId;
      // Auto-create a default epic if none exist
      if (!epicId && project.epics.length === 0) {
        onCreateEpic("General", "Default epic", "#6b7280");
        // We'll rely on the caller to handle the cascade; for now close
        onClose();
        return;
      }
      onCreateTask({
        epicId,
        columnId: taskColumnId,
        name: taskName.trim(),
        description: taskDescription.trim() || undefined,
        priority: taskPriority,
        assignee: taskAssignee.trim() || undefined,
        tags: taskTags ? taskTags.split(",").map((t) => t.trim()).filter(Boolean) : undefined,
        startDate: taskStartDate || undefined,
        dueDate: taskDueDate || undefined,
      });
      onClose();
    } else {
      if (!epicName.trim()) return;
      onCreateEpic(epicName.trim(), epicDescription.trim() || undefined, epicColor);
      onClose();
    }
  };

  const fieldClass =
    "w-full px-2.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-[13px] outline-none font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)] transition-[border-color,box-shadow] duration-150";
  const labelClass =
    "text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.06em] mb-1.5";

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm animate-[modal-fade-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
    >
      <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl w-full max-w-[540px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.4)] animate-[modalIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3.5 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              {mode === "task" ? <Plus className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <span className="text-base font-bold text-[var(--foreground)]">
              New {mode === "task" ? "Task" : "Epic"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
              {(["task", "epic"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "px-3 py-1 text-[11px] font-semibold capitalize transition-colors duration-150",
                    mode === m
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      : "bg-transparent text-[var(--text-muted)] hover:text-[var(--foreground)]"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <IconButton onClick={onClose} title="Close">
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
          {mode === "task" ? (
            <>
              {/* Task Name */}
              <div>
                <div className={labelClass}>Name <span className="text-[var(--danger)]">*</span></div>
                <input
                  ref={nameInputRef}
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="What needs to be done?"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                  className={fieldClass}
                />
              </div>

              {/* Description */}
              <div>
                <div className={labelClass}>Description</div>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional details…"
                  className={cn(fieldClass, "resize-y leading-relaxed")}
                />
              </div>

              {/* Epic + Column row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelClass}>Epic <span className="text-[var(--danger)]">*</span></div>
                  <select value={taskEpicId} onChange={(e) => setTaskEpicId(e.target.value)} className={fieldClass}>
                    {project.epics.length === 0 && <option value="">No epics – one will be created</option>}
                    {project.epics.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={labelClass}>Column</div>
                  <select value={taskColumnId} onChange={(e) => setTaskColumnId(e.target.value)} className={fieldClass}>
                    {project.columns.sort((a, b) => a.position - b.position).map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <div className={labelClass}>Priority</div>
                <div className="flex gap-1.5">
                  {(["low", "medium", "high", "critical"] as KanbanTaskPriority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => setTaskPriority(p)}
                        title={cfg.label}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer border transition-all duration-150",
                          taskPriority === p
                            ? "border-current"
                            : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                        )}
                        style={
                          taskPriority === p
                            ? { background: `${cfg.color}18`, color: cfg.color, borderColor: cfg.color }
                            : undefined
                        }
                      >
                        {cfg.icon} {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assignee + Tags row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelClass}>Assignee</div>
                  <input
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    placeholder="e.g. Alice"
                    className={fieldClass}
                  />
                </div>
                <div>
                  <div className={labelClass}>Tags <span className="font-normal normal-case tracking-normal">(comma-separated)</span></div>
                  <input
                    value={taskTags}
                    onChange={(e) => setTaskTags(e.target.value)}
                    placeholder="e.g. api, design"
                    className={fieldClass}
                  />
                </div>
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className={labelClass}>Start Date</div>
                  <input type="date" value={taskStartDate} onChange={(e) => setTaskStartDate(e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <div className={labelClass}>Due Date</div>
                  <input type="date" value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className={fieldClass} />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Epic Name */}
              <div>
                <div className={labelClass}>Name <span className="text-[var(--danger)]">*</span></div>
                <input
                  ref={nameInputRef}
                  value={epicName}
                  onChange={(e) => setEpicName(e.target.value)}
                  placeholder="Epic name…"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
                  className={fieldClass}
                />
              </div>

              {/* Epic Description */}
              <div>
                <div className={labelClass}>Description</div>
                <textarea
                  value={epicDescription}
                  onChange={(e) => setEpicDescription(e.target.value)}
                  rows={3}
                  placeholder="What is this epic about?"
                  className={cn(fieldClass, "resize-y leading-relaxed")}
                />
              </div>

              {/* Epic Color */}
              <div>
                <div className={labelClass}>Color</div>
                <div className="flex gap-2 flex-wrap">
                  {EPIC_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setEpicColor(color)}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 cursor-pointer transition-all duration-150 hover:scale-110",
                        epicColor === color ? "border-[var(--foreground)] shadow-[0_0_0_2px_var(--background)]" : "border-transparent"
                      )}
                      style={{ background: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)] shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={mode === "task" ? !taskName.trim() : !epicName.trim()}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Create {mode === "task" ? "Task" : "Epic"}
          </Button>
        </div>
      </div>
    </div>
  );
}
