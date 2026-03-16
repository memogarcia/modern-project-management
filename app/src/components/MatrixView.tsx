"use client";

import { useMemo } from "react";
import type { KanbanProject, KanbanTask, KanbanTaskPriority, MatrixQuadrant } from "@/lib/projectTypes";
import type { CreateItemDefaults } from "./CreateItemModal";
import { deriveQuadrant, QUADRANT_CONFIG, PRIORITY_CONFIG } from "@/lib/projectTypes";
import { Badge } from "./ui/badge";
import { EmptyState } from "./ui/empty-state";
import { cn } from "@/lib/utils";

const QUADRANT_PRIORITY: Record<MatrixQuadrant, KanbanTaskPriority> = {
  "do-first": "critical",
  schedule: "high",
  delegate: "medium",
  drop: "low",
};

interface MatrixViewProps {
  project: KanbanProject;
  onUpdateTask: (taskId: string, updates: Partial<KanbanTask>) => void;
  onSelectTask?: (taskId: string) => void;
  onRequestCreate?: (defaults?: CreateItemDefaults) => void;
}

export default function MatrixView({ project, onUpdateTask, onSelectTask, onRequestCreate }: MatrixViewProps) {
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
    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 overflow-hidden">
      {quadrants.map((q) => {
        const cfg = QUADRANT_CONFIG[q];
        const tasks = tasksByQuadrant[q];

        return (
          <div
            key={q}
            className="flex flex-col overflow-hidden rounded-xl border-[1.5px] border-[var(--border)] bg-[var(--panel-bg)] transition-[border-color] duration-150"
            style={{ background: `linear-gradient(135deg, ${cfg.color}06, transparent)` }}
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
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base">{cfg.icon}</span>
                <span className="text-sm font-bold text-[var(--foreground)]">{cfg.label}</span>
                <Badge color={cfg.color} size="sm">{tasks.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[var(--text-muted)]">{cfg.tag}</span>
                {onRequestCreate && (
                  <button
                    onClick={() => onRequestCreate({ priority: QUADRANT_PRIORITY[q] })}
                    title={`Add ${cfg.tag} task`}
                    className="flex items-center justify-center w-6 h-6 rounded-md border border-[var(--border)] bg-transparent text-[var(--text-muted)] text-sm leading-none cursor-pointer transition-all duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* Task list */}
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-2.5">
              {tasks.map((task) => {
                const epic = getEpic(task.epicId);
                const priorityCfg = PRIORITY_CONFIG[task.priority];

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); }}
                    onClick={() => onSelectTask?.(task.id)}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2.5 cursor-pointer shadow-sm transition-shadow duration-150 hover:shadow-md"
                    style={{ borderLeft: `3px solid ${cfg.color}` }}
                  >
                    {epic && (
                      <div className="flex items-center gap-1 mb-1 text-[11px] font-semibold" style={{ color: epic.color ?? "var(--text-muted)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: epic.color ?? "var(--text-muted)" }} />
                        {epic.name}
                      </div>
                    )}
                    <div className="text-[13px] text-[var(--foreground)] leading-[1.4] break-words">
                      {task.name}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <Badge color={priorityCfg.color} size="sm">
                        {priorityCfg.icon} {priorityCfg.label}
                      </Badge>
                      {task.assignee && (
                        <Badge size="sm">👤 {task.assignee}</Badge>
                      )}
                      {task.dueDate && (
                        <Badge size="sm">📅 {task.dueDate}</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
              {tasks.length === 0 && (
                <EmptyState title="No tasks" compact />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
