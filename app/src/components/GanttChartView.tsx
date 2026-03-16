"use client";

import { useMemo } from "react";
import type { KanbanProject } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";

interface GanttChartViewProps {
  project: KanbanProject;
  onSelectTask?: (taskId: string) => void;
}

export default function GanttChartView({ project, onSelectTask }: GanttChartViewProps) {
  const tasks = useMemo(() => {
    return project.tasks
      .filter((t) => t.startDate && t.dueDate)
      .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  }, [project.tasks]);

  const { minDate, maxDate, totalDays } = useMemo(() => {
    if (tasks.length === 0) return { minDate: new Date(), maxDate: new Date(), totalDays: 30 };
    const dates = tasks.flatMap((t) => [new Date(t.startDate!), new Date(t.dueDate!)]);
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    // Add padding
    min.setDate(min.getDate() - 2);
    max.setDate(max.getDate() + 2);
    const days = Math.max(7, Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)));
    return { minDate: min, maxDate: max, totalDays: days };
  }, [tasks]);

  const getEpic = (epicId: string) => project.epics.find((e) => e.id === epicId);

  const dayWidth = 36;
  const rowHeight = 38;
  const headerHeight = 48;

  if (tasks.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", fontSize: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📊</div>
          <div>No tasks with date ranges. Add startDate and dueDate to see the timeline.</div>
        </div>
      </div>
    );
  }

  // Group by epic
  const epicGroups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const group = epicGroups.get(task.epicId) ?? [];
    group.push(task);
    epicGroups.set(task.epicId, group);
  }

  const generateDayHeaders = () => {
    const headers = [];
    const current = new Date(minDate);
    for (let i = 0; i < totalDays; i++) {
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      headers.push(
        <div
          key={i}
          style={{
            width: dayWidth, minWidth: dayWidth, textAlign: "center", fontSize: 10,
            color: isWeekend ? "var(--text-subtle)" : "var(--text-muted)",
            borderRight: "1px solid var(--border)", padding: "4px 0",
            background: isWeekend ? "rgba(0,0,0,0.02)" : undefined,
          }}
        >
          <div style={{ fontWeight: 600 }}>{current.getDate()}</div>
          <div style={{ fontSize: 9 }}>{current.toLocaleDateString("en", { month: "short" })}</div>
        </div>
      );
      current.setDate(current.getDate() + 1);
    }
    return headers;
  };

  let rowIndex = 0;

  return (
    <div style={{ flex: 1, overflow: "auto", background: "var(--panel-bg)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ minWidth: totalDays * dayWidth + 200, position: "relative" }}>
        {/* Header */}
        <div style={{ display: "flex", position: "sticky", top: 0, zIndex: 2, background: "var(--panel-bg)", borderBottom: "2px solid var(--border)" }}>
          <div style={{ width: 200, minWidth: 200, padding: "8px 12px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", borderRight: "1px solid var(--border)" }}>
            TASK
          </div>
          <div style={{ display: "flex" }}>
            {generateDayHeaders()}
          </div>
        </div>

        {/* Rows */}
        {Array.from(epicGroups.entries()).map(([epicId, epicTasks]) => {
          const epic = getEpic(epicId);
          return (
            <div key={epicId}>
              {/* Epic header row */}
              <div style={{
                display: "flex", background: `${epic?.color ?? "#6b7280"}08`,
                borderBottom: "1px solid var(--border)",
              }}>
                <div style={{
                  width: 200, minWidth: 200, padding: "6px 12px", fontSize: 11, fontWeight: 700,
                  color: epic?.color ?? "var(--text-muted)", borderRight: "1px solid var(--border)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: epic?.color ?? "#6b7280" }} />
                  {epic?.name ?? "Unknown Epic"}
                </div>
                <div style={{ flex: 1, height: 28 }} />
              </div>

              {/* Task rows */}
              {epicTasks.map((task) => {
                const start = new Date(task.startDate!);
                const end = new Date(task.dueDate!);
                const startOffset = Math.max(0, Math.round((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
                const duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                const priorityCfg = PRIORITY_CONFIG[task.priority];
                rowIndex++;

                return (
                  <div
                    key={task.id}
                    style={{
                      display: "flex", borderBottom: "1px solid var(--border)",
                      background: rowIndex % 2 === 0 ? "transparent" : "rgba(0,0,0,0.01)",
                    }}
                  >
                    <div
                      onClick={() => onSelectTask?.(task.id)}
                      style={{
                        width: 200, minWidth: 200, padding: "6px 12px", fontSize: 12,
                        color: "var(--foreground)", borderRight: "1px solid var(--border)",
                        display: "flex", alignItems: "center", gap: 6, overflow: "hidden",
                        cursor: onSelectTask ? "pointer" : undefined,
                      }}
                    >
                      <span style={{ fontSize: 10, color: priorityCfg.color }}>{priorityCfg.icon}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.name}
                      </span>
                    </div>
                    <div style={{ position: "relative", height: rowHeight, flex: 1 }}>
                      {/* Bar */}
                      <div
                        onClick={() => onSelectTask?.(task.id)}
                        style={{
                          position: "absolute",
                          left: startOffset * dayWidth + 2,
                          width: duration * dayWidth - 4,
                          top: 8,
                          height: rowHeight - 16,
                          borderRadius: 4,
                          background: `${epic?.color ?? priorityCfg.color}30`,
                          border: `1px solid ${epic?.color ?? priorityCfg.color}60`,
                          overflow: "hidden",
                          cursor: onSelectTask ? "pointer" : undefined,
                          transition: "filter 0.12s",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                      >
                        {/* Progress fill */}
                        <div style={{
                          height: "100%",
                          width: `${task.progress}%`,
                          background: `${epic?.color ?? priorityCfg.color}50`,
                          borderRadius: 3,
                          transition: "width 0.3s",
                        }} />
                        {/* Label */}
                        <span style={{
                          position: "absolute", top: "50%", left: 6, transform: "translateY(-50%)",
                          fontSize: 10, fontWeight: 600, color: "var(--foreground)",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          maxWidth: "calc(100% - 12px)",
                        }}>
                          {task.progress > 0 && `${task.progress}%`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
