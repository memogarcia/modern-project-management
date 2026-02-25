"use client";

import { useState, useEffect, useCallback } from "react";
import type { GanttTask, TaskStatus, TaskPriority, TaskLink } from "@/lib/ganttTypes";
import { STATUS_CONFIG, PRIORITY_CONFIG, LINK_TYPE_CONFIG } from "@/lib/ganttTypes";

interface Props {
  task: GanttTask;
  onSave: (updates: Partial<GanttTask>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function GanttTaskModal({ task, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [startDate, setStartDate] = useState(task.startDate);
  const [endDate, setEndDate] = useState(task.endDate);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [progress, setProgress] = useState(task.progress);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [group, setGroup] = useState(task.group ?? "");
  const [color, setColor] = useState(task.color ?? "");
  const [links, setLinks] = useState<TaskLink[]>([...task.links]);
  const [metadata, setMetadata] = useState<Record<string, string>>({ ...task.metadata });
  const [activeTab, setActiveTab] = useState<"details" | "links" | "metadata">("details");

  // New link form
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkType, setNewLinkType] = useState<TaskLink["type"]>("jira");

  // New metadata form
  const [newMetaKey, setNewMetaKey] = useState("");
  const [newMetaValue, setNewMetaValue] = useState("");

  const handleSave = useCallback(() => {
    onSave({
      name: name.trim() || "Untitled Task",
      description: description.trim() || undefined,
      startDate,
      endDate,
      status,
      priority,
      progress,
      assignee: assignee.trim() || undefined,
      group: group.trim() || undefined,
      color: color.trim() || undefined,
      links,
      metadata,
    });
    onClose();
  }, [name, description, startDate, endDate, status, priority, progress, assignee, group, color, links, metadata, onSave, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleSave, onClose]);

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks([...links, { label: newLinkLabel.trim() || newLinkUrl.trim(), url: newLinkUrl.trim(), type: newLinkType }]);
    setNewLinkLabel("");
    setNewLinkUrl("");
  };

  const removeLink = (idx: number) => {
    setLinks(links.filter((_, i) => i !== idx));
  };

  const addMetadata = () => {
    if (!newMetaKey.trim()) return;
    setMetadata({ ...metadata, [newMetaKey.trim()]: newMetaValue.trim() });
    setNewMetaKey("");
    setNewMetaValue("");
  };

  const removeMetadata = (key: string) => {
    const next = { ...metadata };
    delete next[key];
    setMetadata(next);
  };

  const statusColors = Object.entries(STATUS_CONFIG);
  const priorityOptions = Object.entries(PRIORITY_CONFIG);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 16px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    background: "transparent",
    color: active ? "var(--accent)" : "var(--text-muted)",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="edit-modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="edit-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 18 }}>{STATUS_CONFIG[status].icon}</span>
            <span>Edit Task</span>
          </div>
          <button className="edit-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 20px" }}>
          <button style={tabStyle(activeTab === "details")} onClick={() => setActiveTab("details")}>
            Details
          </button>
          <button style={tabStyle(activeTab === "links")} onClick={() => setActiveTab("links")}>
            Links {links.length > 0 && <span style={{ marginLeft: 4, fontSize: 10, background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: 8, padding: "1px 6px" }}>{links.length}</span>}
          </button>
          <button style={tabStyle(activeTab === "metadata")} onClick={() => setActiveTab("metadata")}>
            Metadata {Object.keys(metadata).length > 0 && <span style={{ marginLeft: 4, fontSize: 10, background: "var(--accent)", color: "var(--accent-foreground)", borderRadius: 8, padding: "1px 6px" }}>{Object.keys(metadata).length}</span>}
          </button>
        </div>

        {/* Body */}
        <div className="edit-modal-body">
          {activeTab === "details" && (
            <>
              {/* Name */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Task Name</label>
                <input
                  className="edit-modal-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Task name..."
                  autoFocus
                />
              </div>

              {/* Description */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Description</label>
                <textarea
                  className="edit-modal-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details..."
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="edit-modal-field">
                  <label className="edit-modal-label">Start Date</label>
                  <input
                    className="edit-modal-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="edit-modal-field">
                  <label className="edit-modal-label">End Date</label>
                  <input
                    className="edit-modal-input"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Status</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {statusColors.map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setStatus(key as TaskStatus);
                        if (key === "completed") setProgress(100);
                        if (key === "not-started") setProgress(0);
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: status === key ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                        background: status === key ? cfg.color + "20" : "transparent",
                        color: status === key ? cfg.color : "var(--text-muted)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Priority</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {priorityOptions.map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setPriority(key as TaskPriority)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: priority === key ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                        background: priority === key ? cfg.color + "20" : "transparent",
                        color: priority === key ? cfg.color : "var(--text-muted)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Progress — {progress}%</label>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={progress}
                    onChange={(e) => setProgress(Number(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--accent)" }}
                  />
                  <input
                    className="edit-modal-input"
                    type="number"
                    min={0}
                    max={100}
                    value={progress}
                    onChange={(e) => setProgress(Math.min(100, Math.max(0, Number(e.target.value))))}
                    style={{ width: 60, textAlign: "center" }}
                  />
                </div>
              </div>

              {/* Assignee + Group */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="edit-modal-field">
                  <label className="edit-modal-label">Assignee</label>
                  <input
                    className="edit-modal-input"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Person or team..."
                  />
                </div>
                <div className="edit-modal-field">
                  <label className="edit-modal-label">Group</label>
                  <input
                    className="edit-modal-input"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                    placeholder="Section name..."
                  />
                </div>
              </div>

              {/* Custom Color */}
              <div className="edit-modal-field">
                <label className="edit-modal-label">Custom Color (optional)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="color"
                    value={color || "#3b82f6"}
                    onChange={(e) => setColor(e.target.value)}
                    style={{ width: 32, height: 32, border: "none", borderRadius: 6, cursor: "pointer", background: "transparent" }}
                  />
                  <input
                    className="edit-modal-input"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="#3b82f6"
                    style={{ flex: 1 }}
                  />
                  {color && (
                    <button
                      onClick={() => setColor("")}
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "links" && (
            <>
              {/* Existing links */}
              {links.length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                  No links yet. Add a JIRA ticket, GitHub PR, or any other link.
                </div>
              )}
              {links.map((link, idx) => {
                const cfg = LINK_TYPE_CONFIG[link.type];
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      background: "var(--surface)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{link.label}</div>
                      <div style={{ fontSize: 11, color: cfg.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {link.url}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: cfg.color + "20",
                        color: cfg.color,
                        fontWeight: 600,
                      }}
                    >
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => removeLink(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              {/* Add link form */}
              <div
                style={{
                  padding: 14,
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px dashed var(--border)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Add Link
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <select
                    className="edit-modal-input"
                    value={newLinkType}
                    onChange={(e) => setNewLinkType(e.target.value as TaskLink["type"])}
                  >
                    {Object.entries(LINK_TYPE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>
                        {cfg.icon} {cfg.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="edit-modal-input"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="Label (e.g. PROJ-123)"
                  />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="edit-modal-input"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ flex: 1 }}
                    onKeyDown={(e) => e.key === "Enter" && addLink()}
                  />
                  <button
                    onClick={addLink}
                    className="edit-modal-btn edit-modal-btn-primary"
                    style={{ padding: "8px 14px" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === "metadata" && (
            <>
              {/* Existing metadata */}
              {Object.keys(metadata).length === 0 && (
                <div style={{ textAlign: "center", padding: 20, color: "var(--text-muted)", fontSize: 13 }}>
                  No metadata yet. Add custom key-value pairs.
                </div>
              )}
              {Object.entries(metadata).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    background: "var(--surface)",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)", minWidth: 80 }}>{key}</span>
                  <input
                    className="edit-modal-input"
                    value={value}
                    onChange={(e) => setMetadata({ ...metadata, [key]: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={() => removeMetadata(key)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: 14,
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {/* Add metadata form */}
              <div
                style={{
                  padding: 14,
                  background: "var(--surface)",
                  borderRadius: 8,
                  border: "1px dashed var(--border)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Add Metadata
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    className="edit-modal-input"
                    value={newMetaKey}
                    onChange={(e) => setNewMetaKey(e.target.value)}
                    placeholder="Key"
                    style={{ width: 120 }}
                    onKeyDown={(e) => e.key === "Enter" && addMetadata()}
                  />
                  <input
                    className="edit-modal-input"
                    value={newMetaValue}
                    onChange={(e) => setNewMetaValue(e.target.value)}
                    placeholder="Value"
                    style={{ flex: 1 }}
                    onKeyDown={(e) => e.key === "Enter" && addMetadata()}
                  />
                  <button
                    onClick={addMetadata}
                    className="edit-modal-btn edit-modal-btn-primary"
                    style={{ padding: "8px 14px" }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="edit-modal-footer">
          <button
            onClick={() => {
              if (confirm("Delete this task?")) onDelete();
            }}
            style={{
              marginRight: "auto",
              padding: "8px 14px",
              background: "transparent",
              border: "1px solid #ef444440",
              borderRadius: 6,
              color: "#ef4444",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Delete Task
          </button>
          <button className="edit-modal-btn edit-modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="edit-modal-btn edit-modal-btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
