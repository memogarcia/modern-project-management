"use client";

import { useMemo } from "react";
import type { KanbanProject, KanbanTask, MatrixQuadrant } from "@/lib/projectTypes";
import { deriveQuadrant, QUADRANT_CONFIG, PRIORITY_CONFIG } from "@/lib/projectTypes";

interface MatrixViewProps {
  project: KanbanProject;
  onUpdateTask: (taskId: string, updates: Partial<KanbanTask>) => void;
  onSelectTask?: (taskId: string) => void;
}

export default function MatrixView({ project, onUpdateTask, onSelectTask }: MatrixViewProps) {
  const tasksByQuadrant = useMemo(() => {
    const map: Record<MatrixQuadrant, KanbanTask[]> = {
      "do-first": [],
      schedule: [],
      delegate: [],
      drop: [],
    };
    for (const task of project.tasks.filter((t) => t.columnId !== "done")) {
      const q = deriveQuadrant(task.priority);
      map[q].push(task);
    }
    return map;
  }, [project.tasks]);

  const getEpic = (epicId: string) => project.epics.find((e) => e.id === epicId);

  const handleDrop = (targetQuadrant: MatrixQuadrant, taskId: string) => {
    const updates: Partial<KanbanTask> = {};
    switch (targetQuadrant) {
      case "do-first":
        updates.priority = "critical";
        break;
      case "schedule":
        updates.priority = "high";
        break;
      case "delegate":
        updates.priority = "medium";
        break;
      case "drop":
        updates.priority = "low";
        break;
    }
    onUpdateTask(taskId, updates);
  };

  const quadrants: MatrixQuadrant[] = ["do-first", "schedule", "delegate", "drop"];

  return (
    <div style={{
      flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
      gap: 12, overflow: "hidden",
    }}>
      {quadrants.map((q) => {
        const cfg = QUADRANT_CONFIG[q];
        const tasks = tasksByQuadrant[q];

        return (
          <div
            key={q}
            style={{
              background: "var(--panel-bg)", border: `1.5px solid var(--border)`,
              borderRadius: 12, display: "flex", flexDirection: "column", overflow: "hidden",
              transition: "border-color 0.15s",
            }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = cfg.color; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "var(--border)";
              const taskId = e.dataTransfer.getData("text/plain");
              if (taskId) handleDrop(q, taskId);
            }}
          >
            {/* Quadrant header */}
            <div style={{
              padding: "10px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>{cfg.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, background: `${cfg.color}18`, color: cfg.color,
                  borderRadius: 20, padding: "1px 8px",
                }}>
                  {tasks.length}
                </span>
              </div>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{cfg.tag}</span>
            </div>

            {/* Task list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
              {tasks.map((task) => {
                const epic = getEpic(task.epicId);
                const priorityCfg = PRIORITY_CONFIG[task.priority];

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); }}
                    onClick={() => onSelectTask?.(task.id)}
                    style={{
                      background: "var(--surface)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                      borderLeft: `3px solid ${cfg.color}`,
                      transition: "box-shadow 0.12s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {epic && (
                      <div style={{
                        fontSize: 10, fontWeight: 600, color: epic.color ?? "var(--text-muted)",
                        marginBottom: 3, display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: epic.color ?? "var(--text-muted)" }} />
                        {epic.name}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "var(--foreground)", lineHeight: 1.4, wordBreak: "break-word" }}>
                      {task.name}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 3,
                        background: `${priorityCfg.color}15`, color: priorityCfg.color, fontWeight: 600,
                      }}>
                        {priorityCfg.icon} {priorityCfg.label}
                      </span>
                      {task.assignee && (
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 3,
                          background: "var(--surface-hover)", color: "var(--text-muted)",
                        }}>
                          👤 {task.assignee}
                        </span>
                      )}
                      {task.dueDate && (
                        <span style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 3,
                          background: "var(--surface-hover)", color: "var(--text-muted)",
                        }}>
                          📅 {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-subtle)", fontSize: 12, fontStyle: "italic" }}>
                  No tasks
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
