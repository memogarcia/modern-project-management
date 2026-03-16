"use client";

import { useEffect, useRef, useState } from "react";
import type { KanbanTask, KanbanProject, KanbanTaskPriority } from "@/lib/projectTypes";
import { PRIORITY_CONFIG, LINK_TYPE_CONFIG, deriveQuadrant, QUADRANT_CONFIG, deriveStatusFromColumn, DERIVED_STATUS_CONFIG } from "@/lib/projectTypes";
import { X, ExternalLink, Trash2, Plus } from "lucide-react";

interface TaskDetailModalProps {
  task: KanbanTask;
  project: KanbanProject;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<KanbanTask>) => void;
  onDelete: (taskId: string) => void;
}

const FIELD_STYLE: React.CSSProperties = {
  padding: "7px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 7,
  color: "var(--foreground)",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 5,
};

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

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        width: "100%",
        maxWidth: 700,
        maxHeight: "90vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        animation: "modalIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
      }}>
        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            {/* Epic breadcrumb */}
            {epic && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontSize: 11, color: epic.color ?? "var(--text-muted)", fontWeight: 600 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: epic.color ?? "var(--text-muted)", display: "inline-block" }} />
                {epic.name}
                {column && <><span style={{ color: "var(--text-subtle)", fontWeight: 400 }}>·</span><span style={{ color: column.color ?? "var(--text-muted)" }}>{column.name}</span></>}
              </div>
            )}
            {/* Quadrant & Status Badges */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: `${quadrantCfg.color}15`, color: quadrantCfg.color,
                border: `1px solid ${quadrantCfg.color}30`,
              }}>
                {quadrantCfg.icon} {quadrantCfg.label}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                background: `${statusCfg.color}15`, color: statusCfg.color,
                border: `1px solid ${statusCfg.color}30`,
              }}>
                {statusCfg.icon} {statusCfg.label}
              </span>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              style={{ ...FIELD_STYLE, fontSize: 18, fontWeight: 700, background: "transparent", border: "none", padding: "0", borderRadius: 0, letterSpacing: "-0.01em" }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => { if (confirm("Delete this task?")) { onDelete(task.id); onClose(); } }}
              title="Delete task"
              style={{ width: 32, height: 32, background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#ef444418"; e.currentTarget.style.borderColor = "#ef4444"; e.currentTarget.style.color = "#ef4444"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              title="Close"
              style={{ width: 32, height: 32, background: "transparent", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Description */}
          <div>
            <div style={LABEL_STYLE}>Description</div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={3}
              placeholder="Add a description…"
              style={{ ...FIELD_STYLE, resize: "vertical", lineHeight: 1.55 }}
            />
          </div>

          {/* 2-col metadata row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Priority */}
            <div>
              <div style={LABEL_STYLE}>Priority</div>
              <div style={{ display: "flex", gap: 6 }}>
                {(["low", "medium", "high", "critical"] as KanbanTaskPriority[]).map((p) => {
                  const cfg = PRIORITY_CONFIG[p];
                  return (
                    <button
                      key={p}
                      onClick={() => handlePriorityChange(p)}
                      title={cfg.label}
                      style={{
                        flex: 1, padding: "5px 0", borderRadius: 6, fontSize: 11, fontWeight: 600,
                        cursor: "pointer", border: `1px solid ${priority === p ? cfg.color : "var(--border)"}`,
                        background: priority === p ? `${cfg.color}18` : "transparent",
                        color: priority === p ? cfg.color : "var(--text-muted)",
                        transition: "all 0.12s",
                      }}
                    >
                      {cfg.icon}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: priorityCfg.color, marginTop: 4, fontWeight: 600 }}>{priorityCfg.label}</div>
            </div>

            {/* Column */}
            <div>
              <div style={LABEL_STYLE}>Column</div>
              <select value={columnId} onChange={(e) => handleColumnChange(e.target.value)} style={{ ...FIELD_STYLE }}>
                {project.columns.sort((a, b) => a.position - b.position).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Epic */}
            <div>
              <div style={LABEL_STYLE}>Epic</div>
              <select value={epicId} onChange={(e) => handleEpicChange(e.target.value)} style={{ ...FIELD_STYLE }}>
                {project.epics.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <div style={LABEL_STYLE}>Assignee</div>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={handleAssigneeBlur}
                placeholder="e.g. Alice"
                style={FIELD_STYLE}
              />
            </div>

            {/* Tags */}
            <div>
              <div style={LABEL_STYLE}>Tags <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(comma-separated)</span></div>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                onBlur={handleTagsBlur}
                placeholder="e.g. api, design"
                style={FIELD_STYLE}
              />
            </div>

            {/* Start date */}
            <div>
              <div style={LABEL_STYLE}>Start Date</div>
              <input type="date" value={startDate} onChange={(e) => handleStartDateChange(e.target.value)} style={FIELD_STYLE} />
            </div>

            {/* Due date */}
            <div>
              <div style={LABEL_STYLE}>Due Date</div>
              <input type="date" value={dueDate} onChange={(e) => handleDueDateChange(e.target.value)} style={FIELD_STYLE} />
            </div>
          </div>

          {/* Progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", ...LABEL_STYLE }}>
              <span>Progress</span>
              <span style={{ color: "#22c55e", fontWeight: 700 }}>{progress}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={progress}
              onChange={(e) => handleProgressChange(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#22c55e" }}
            />
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#22c55e", borderRadius: 2, transition: "width 0.2s" }} />
            </div>
          </div>

          {/* Links */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={LABEL_STYLE}>Links</div>
              <button
                onClick={() => setShowLinkForm(!showLinkForm)}
                style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)", background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
              >
                <Plus size={12} /> Add link
              </button>
            </div>

            {showLinkForm && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 12px 8px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Label" style={FIELD_STYLE} />
                  <select value={linkType} onChange={(e) => setLinkType(e.target.value as typeof linkType)} style={FIELD_STYLE}>
                    {(Object.keys(LINK_TYPE_CONFIG) as Array<keyof typeof LINK_TYPE_CONFIG>).map((t) => (
                      <option key={t} value={t}>{LINK_TYPE_CONFIG[t].icon} {LINK_TYPE_CONFIG[t].label}</option>
                    ))}
                  </select>
                </div>
                <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" style={FIELD_STYLE} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleAddLink} style={{ flex: 1, padding: "6px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add</button>
                  <button onClick={() => setShowLinkForm(false)} style={{ flex: 1, padding: "6px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            )}

            {task.links.length === 0 && !showLinkForm && (
              <div style={{ fontSize: 12, color: "var(--text-subtle)", fontStyle: "italic" }}>No links yet</div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {task.links.map((link, idx) => {
                const cfg = LINK_TYPE_CONFIG[link.type];
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 7 }}>
                    <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                    <a href={link.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, color: cfg.color, textDecoration: "none", display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.label}</span>
                      <ExternalLink size={11} style={{ flexShrink: 0 }} />
                    </a>
                    <button onClick={() => handleRemoveLink(idx)} style={{ background: "transparent", border: "none", color: "var(--text-subtle)", cursor: "pointer", padding: 2 }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timestamps */}
          <div style={{ display: "flex", gap: 20, fontSize: 11, color: "var(--text-subtle)", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
            <span>Created {new Date(task.createdAt).toLocaleString()}</span>
            <span>Updated {new Date(task.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
