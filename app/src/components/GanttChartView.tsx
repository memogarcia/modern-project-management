"use client";

import { useMemo } from "react";
import type { KanbanProject } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";
import { EmptyState } from "./ui/empty-state";
import { BarChart3 } from "lucide-react";

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

  // Today marker position
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = Math.round((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  const showTodayMarker = todayOffset >= 0 && todayOffset <= totalDays;

  if (tasks.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          icon={<BarChart3 />}
          title="No tasks with date ranges"
          description="Add startDate and dueDate to see the timeline."
        />
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
      const isToday = current.toDateString() === today.toDateString();
      headers.push(
        <div
          key={i}
          className={`text-center text-[10px] border-r border-[var(--border)] py-1 ${
            isToday ? "bg-[var(--accent-soft)] font-bold text-[var(--foreground)]" : isWeekend ? "text-[var(--text-subtle)] bg-[var(--surface-hover)]/30" : "text-[var(--text-muted)]"
          }`}
          style={{ width: dayWidth, minWidth: dayWidth }}
        >
          <div className="font-semibold">{current.getDate()}</div>
          <div className="text-[9px]">{current.toLocaleDateString("en", { month: "short" })}</div>
        </div>
      );
      current.setDate(current.getDate() + 1);
    }
    return headers;
  };

  let rowIndex = 0;

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--panel-bg)]">
      <div className="relative" style={{ minWidth: totalDays * dayWidth + 200 }}>
        {/* Today marker line */}
        {showTodayMarker && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--danger)] z-10 pointer-events-none opacity-60"
            style={{ left: 200 + todayOffset * dayWidth + dayWidth / 2 }}
          >
            <div className="absolute -top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[var(--danger)]" />
          </div>
        )}

        {/* Header */}
        <div className="flex sticky top-0 z-20 bg-[var(--panel-bg)] border-b-2 border-[var(--border)]">
          <div className="w-[200px] min-w-[200px] px-3 py-2 text-[11px] font-bold text-[var(--text-muted)] border-r border-[var(--border)] uppercase tracking-wider">
            Task
          </div>
          <div className="flex">
            {generateDayHeaders()}
          </div>
        </div>

        {/* Rows */}
        {Array.from(epicGroups.entries()).map(([epicId, epicTasks]) => {
          const epic = getEpic(epicId);
          return (
            <div key={epicId}>
              {/* Epic header row */}
              <div className="flex border-b border-[var(--border)]" style={{ background: `${epic?.color ?? "#6b7280"}08` }}>
                <div className="w-[200px] min-w-[200px] px-3 py-1.5 text-[11px] font-bold border-r border-[var(--border)] flex items-center gap-1.5" style={{ color: epic?.color ?? "var(--text-muted)" }}>
                  <span className="w-2 h-2 rounded-full" style={{ background: epic?.color ?? "#6b7280" }} />
                  {epic?.name ?? "Unknown Epic"}
                </div>
                <div className="flex-1 h-7" />
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
                    className={`flex border-b border-[var(--border)] ${rowIndex % 2 === 0 ? "" : "bg-[var(--surface-hover)]/20"}`}
                  >
                    <div
                      onClick={() => onSelectTask?.(task.id)}
                      className="w-[200px] min-w-[200px] px-3 py-1.5 text-xs text-[var(--foreground)] border-r border-[var(--border)] flex items-center gap-1.5 overflow-hidden cursor-pointer hover:bg-[var(--surface-hover)]"
                    >
                      <span className="text-[10px]" style={{ color: priorityCfg.color }}>{priorityCfg.icon}</span>
                      <span className="truncate">{task.name}</span>
                    </div>
                    <div className="relative flex-1" style={{ height: rowHeight }}>
                      {/* Bar */}
                      <div
                        onClick={() => onSelectTask?.(task.id)}
                        className="absolute rounded-md overflow-hidden cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                        style={{
                          left: startOffset * dayWidth + 2,
                          width: duration * dayWidth - 4,
                          top: 6,
                          height: rowHeight - 12,
                          background: `${epic?.color ?? priorityCfg.color}40`,
                          border: `1px solid ${epic?.color ?? priorityCfg.color}70`,
                        }}
                      >
                        {/* Progress fill */}
                        <div
                          className="h-full rounded-[5px] transition-[width] duration-300"
                          style={{
                            width: `${task.progress}%`,
                            background: `${epic?.color ?? priorityCfg.color}60`,
                          }}
                        />
                        {/* Label */}
                        <span className="absolute top-1/2 left-1.5 -translate-y-1/2 text-[10px] font-semibold text-[var(--foreground)] truncate max-w-[calc(100%-12px)]">
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
