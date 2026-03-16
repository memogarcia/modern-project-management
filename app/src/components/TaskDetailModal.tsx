"use client";

import { useEffect, useRef, useState } from "react";
import type { KanbanTask, KanbanProject, KanbanTaskPriority } from "@/lib/projectTypes";
import { PRIORITY_CONFIG, LINK_TYPE_CONFIG, deriveQuadrant, QUADRANT_CONFIG, deriveStatusFromColumn, DERIVED_STATUS_CONFIG } from "@/lib/projectTypes";
import { X, ExternalLink, Trash2, Plus } from "lucide-react";
import { Badge } from "./ui/badge";
import { IconButton } from "./ui/icon-button";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TaskDetailModalProps {
  task: KanbanTask;
  project: KanbanProject;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<KanbanTask>) => void;
  onDelete: (taskId: string) => void;
}

export default function TaskDetailModal({ task, project, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  // Local editable state — push to store on change
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [startDate, setStartDate] = useState(task.startDate ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [progress, setProgress] = useState(task.progress);
  const [priority, setPriority] = useState<KanbanTaskPriority>(task.priority);
  const [tags, setTags] = useState(task.tags.join(", "));
  const [columnId, setColumnId] = useState(task.columnId);
  const [epicId, setEpicId] = useState(task.epicId);

  // New link form
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkType, setLinkType] = useState<KanbanTask["links"][0]["type"]>("other");

  const backdropRef = useRef<HTMLDivElement>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const debouncedSave = (updates: Partial<KanbanTask>) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onUpdate(task.id, updates);
    }, 400);
  };

  const handleNameBlur = () => { if (name.trim() && name !== task.name) onUpdate(task.id, { name: name.trim() }); };
  const handleDescriptionBlur = () => { if (description !== (task.description ?? "")) onUpdate(task.id, { description: description || undefined }); };
  const handleAssigneeBlur = () => { if (assignee !== (task.assignee ?? "")) onUpdate(task.id, { assignee: assignee || undefined }); };
  const handleStartDateChange = (v: string) => { setStartDate(v); onUpdate(task.id, { startDate: v || undefined }); };
  const handleDueDateChange = (v: string) => { setDueDate(v); onUpdate(task.id, { dueDate: v || undefined }); };
  const handlePriorityChange = (v: KanbanTaskPriority) => { setPriority(v); onUpdate(task.id, { priority: v }); };
  const handleColumnChange = (v: string) => { setColumnId(v); onUpdate(task.id, { columnId: v }); };
  const handleEpicChange = (v: string) => { setEpicId(v); onUpdate(task.id, { epicId: v }); };
  const handleTagsBlur = () => {
    const parsed = tags.split(",").map((t) => t.trim()).filter(Boolean);
    onUpdate(task.id, { tags: parsed });
  };
  const handleProgressChange = (v: number) => {
    setProgress(v);
    debouncedSave({ progress: v });
  };

  const handleAddLink = () => {
    if (!linkLabel.trim() || !linkUrl.trim()) return;
    onUpdate(task.id, { links: [...task.links, { label: linkLabel.trim(), url: linkUrl.trim(), type: linkType }] });
    setLinkLabel(""); setLinkUrl(""); setLinkType("other"); setShowLinkForm(false);
  };

  const handleRemoveLink = (idx: number) => {
    onUpdate(task.id, { links: task.links.filter((_, i) => i !== idx) });
  };

  const epic = project.epics.find((e) => e.id === epicId);
  const column = project.columns.find((c) => c.id === columnId);
  const priorityCfg = PRIORITY_CONFIG[priority];
  const quadrant = deriveQuadrant(priority);
  const quadrantCfg = QUADRANT_CONFIG[quadrant];
  const derivedStatus = deriveStatusFromColumn(columnId);
  const statusCfg = DERIVED_STATUS_CONFIG[derivedStatus];

  const fieldClass = "w-full px-2.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-[13px] outline-none font-[inherit] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]";
  const labelClass = "text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.06em] mb-1.5";

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[1000] flex items-center justify-center p-5 bg-black/55 backdrop-blur-sm animate-[modal-fade-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
    >
      <div className="bg-[var(--panel-bg)] border border-[var(--border)] rounded-2xl w-full max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.4)] animate-[modalIn_0.18s_cubic-bezier(0.34,1.56,0.64,1)]">

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3.5 border-b border-[var(--border)] shrink-0">
          <div className="flex-1 min-w-0">
            {/* Epic breadcrumb */}
            {epic && (
              <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold" style={{ color: epic.color ?? "var(--text-muted)" }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: epic.color ?? "var(--text-muted)" }} />
                {epic.name}
                {column && <><span className="text-[var(--text-subtle)] font-normal">·</span><span style={{ color: column.color ?? "var(--text-muted)" }}>{column.name}</span></>}
              </div>
            )}
            {/* Quadrant & Status Badges */}
            <div className="flex gap-1.5 mb-2 flex-wrap">
              <Badge color={quadrantCfg.color} variant="outline" size="sm">
                {quadrantCfg.icon} {quadrantCfg.label}
              </Badge>
              <Badge color={statusCfg.color} variant="outline" size="sm">
                {statusCfg.icon} {statusCfg.label}
              </Badge>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full text-lg font-bold bg-transparent border-none p-0 outline-none text-[var(--foreground)] tracking-[-0.01em]"
            />
          </div>
          <div className="flex gap-1.5 shrink-0">
            <IconButton
              hoverVariant="danger"
              onClick={() => { if (confirm("Delete this task?")) { onDelete(task.id); onClose(); } }}
              title="Delete task"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton onClick={onClose} title="Close">
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Description */}
          <div>
            <div className={labelClass}>Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={3}
              placeholder="Add a description…"
              className={cn(fieldClass, "resize-y leading-relaxed")}
            />
          </div>

          {/* ── Details Section ── */}
          <div>
            <div className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wider mb-3 pb-1 border-b border-[var(--border)]">Details</div>
            <div className="grid grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <div className={labelClass}>Priority</div>
                <div className="flex gap-1.5">
                  {(["low", "medium", "high", "critical"] as KanbanTaskPriority[]).map((p) => {
                    const cfg = PRIORITY_CONFIG[p];
                    return (
                      <button
                        key={p}
                        onClick={() => handlePriorityChange(p)}
                        title={cfg.label}
                        className={cn(
                          "flex-1 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer border transition-all duration-150",
                          priority === p
                            ? "border-current"
                            : "border-[var(--border)] bg-transparent text-[var(--text-muted)]"
                        )}
                        style={priority === p ? { background: `${cfg.color}18`, color: cfg.color, borderColor: cfg.color } : undefined}
                      >
                        {cfg.icon}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] mt-1 font-semibold" style={{ color: priorityCfg.color }}>{priorityCfg.label}</div>
              </div>

              {/* Column */}
              <div>
                <div className={labelClass}>Column</div>
                <select value={columnId} onChange={(e) => handleColumnChange(e.target.value)} className={fieldClass}>
                  {project.columns.sort((a, b) => a.position - b.position).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Epic */}
              <div>
                <div className={labelClass}>Epic</div>
                <select value={epicId} onChange={(e) => handleEpicChange(e.target.value)} className={fieldClass}>
                  {project.epics.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <div className={labelClass}>Assignee</div>
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  onBlur={handleAssigneeBlur}
                  placeholder="e.g. Alice"
                  className={fieldClass}
                />
              </div>

              {/* Tags */}
              <div>
                <div className={labelClass}>Tags <span className="font-normal normal-case tracking-normal">(comma-separated)</span></div>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  onBlur={handleTagsBlur}
                  placeholder="e.g. api, design"
                  className={fieldClass}
                />
              </div>
            </div>
          </div>

          {/* ── Schedule Section ── */}
          <div>
            <div className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wider mb-3 pb-1 border-b border-[var(--border)]">Schedule</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className={labelClass}>Start Date</div>
                <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} className={fieldClass} />
              </div>
              <div>
                <div className={labelClass}>Due Date</div>
                <input type="date" value={dueDate} onChange={(e) => handleDueDateChange(e.target.value)} className={fieldClass} />
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4">
              <div className="flex justify-between text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-[0.06em] mb-1.5">
                <span>Progress</span>
                <span className="text-[var(--success)] font-bold">{progress}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={progress}
                onChange={(e) => handleProgressChange(Number(e.target.value))}
                className="w-full accent-[var(--success)]"
              />
            </div>
          </div>

          {/* ── Links Section ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-[var(--text-subtle)] uppercase tracking-wider pb-1 border-b border-[var(--border)] flex-1 mr-4">Links</div>
              <button
                onClick={() => setShowLinkForm(!showLinkForm)}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)] bg-transparent border-none cursor-pointer hover:opacity-80"
              >
                <Plus className="h-3 w-3" /> Add link
              </button>
            </div>

            {showLinkForm && (
              <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-3 mb-2.5 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" className={fieldClass} />
                  <select value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)} className={fieldClass}>
                    {(Object.keys(LINK_TYPE_CONFIG) as Array<keyof typeof LINK_TYPE_CONFIG>).map((t) => (
                      <option key={t} value={t}>{LINK_TYPE_CONFIG[t].icon} {LINK_TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" className={fieldClass} />
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={handleAddLink}>Add</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowLinkForm(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {task.links.length === 0 && !showLinkForm && (
              <div className="text-xs text-[var(--text-subtle)] italic">No links yet</div>
            )}

            <div className="flex flex-col gap-1.5">
              {task.links.map((link, idx) => {
                const cfg = LINK_TYPE_CONFIG[link.type];
                return (
                  <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg">
                    <span className="text-sm">{cfg.icon}</span>
                    <a href={link.url} target="_blank" rel="noreferrer" className="flex-1 text-[13px] no-underline flex items-center gap-1.5 overflow-hidden" style={{ color: cfg.color }}>
                      <span className="truncate">{link.label}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <IconButton size="sm" hoverVariant="danger" onClick={() => handleRemoveLink(idx)}>
                      <X className="h-3 w-3" />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timestamps */}
          <div className="flex gap-5 text-[11px] text-[var(--text-subtle)] pt-1 border-t border-[var(--border)]">
            <span>Created {new Date(task.createdAt).toLocaleString()}</span>
            <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
