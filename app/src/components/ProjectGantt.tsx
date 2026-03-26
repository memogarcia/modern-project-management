"use client";

import type { ProjectDocument, ProjectTask } from "@/lib/ganttTypes";
import { cn } from "@/lib/utils";

export type GanttZoom = "weeks" | "months" | "quarters";

type ProjectGanttProps = {
  project: ProjectDocument;
  selectedTaskId: string | null;
  zoom: GanttZoom;
  onSelectTask: (taskId: string) => void;
  onZoomChange: (zoom: GanttZoom) => void;
};

const ZOOM_CONFIG: Record<GanttZoom, { dayWidth: number; label: string }> = {
  weeks: { dayWidth: 32, label: "Week detail" },
  months: { dayWidth: 20, label: "Month balance" },
  quarters: { dayWidth: 12, label: "Quarter overview" },
};

const TASK_BAR_HEIGHT = 18;
const TASK_ROW_HEIGHT = 54;

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffInDays(start: Date, end: Date): number {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatCompactDate(value?: string | null): string {
  if (!value) return "Unscheduled";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function taskAccent(task: ProjectTask, project: ProjectDocument): string {
  if (task.color) return task.color;
  const column = project.columns.find((entry) => entry.id === task.columnId);
  return column?.color ?? "var(--accent)";
}

export function ProjectGantt({
  project,
  selectedTaskId,
  zoom,
  onSelectTask,
  onZoomChange,
}: ProjectGanttProps) {
  const scheduledTasks = project.tasks.filter((task) => task.startDate && task.dueDate);
  const unscheduledTasks = project.tasks.filter((task) => !task.startDate || !task.dueDate);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const parsedStarts = scheduledTasks
    .map((task) => parseDate(task.startDate))
    .filter((entry): entry is Date => Boolean(entry));
  const parsedEnds = scheduledTasks
    .map((task) => parseDate(task.dueDate))
    .filter((entry): entry is Date => Boolean(entry));

  const rangeStart = parsedStarts.length > 0
    ? addDays(
        parsedStarts.reduce((earliest, current) => (current < earliest ? current : earliest)),
        -3
      )
    : addDays(todayUtc, -7);
  const rangeEnd = parsedEnds.length > 0
    ? addDays(
        parsedEnds.reduce((latest, current) => (current > latest ? current : latest)),
        5
      )
    : addDays(todayUtc, 21);

  const totalDays = Math.max(diffInDays(rangeStart, rangeEnd) + 1, 1);
  const dayWidth = ZOOM_CONFIG[zoom].dayWidth;
  const timelineWidth = totalDays * dayWidth;
  const days = Array.from({ length: totalDays }, (_, index) => addDays(rangeStart, index));
  const rowIndexByTaskId = new Map(scheduledTasks.map((task, index) => [task.id, index]));
  const taskById = new Map(project.tasks.map((task) => [task.id, task]));
  const todayOffset = diffInDays(rangeStart, todayUtc);

  const monthSpans: Array<{ key: string; label: string; left: number; width: number }> = [];
  for (let index = 0; index < days.length; ) {
    const current = days[index];
    const key = `${current.getUTCFullYear()}-${current.getUTCMonth()}`;
    let endIndex = index;
    while (
      endIndex + 1 < days.length &&
      days[endIndex + 1].getUTCFullYear() === current.getUTCFullYear() &&
      days[endIndex + 1].getUTCMonth() === current.getUTCMonth()
    ) {
      endIndex += 1;
    }
    monthSpans.push({
      key,
      label: formatMonthLabel(current),
      left: index * dayWidth,
      width: (endIndex - index + 1) * dayWidth,
    });
    index = endIndex + 1;
  }

  const dependencyLines = scheduledTasks.flatMap((task) => {
    const taskStart = parseDate(task.startDate);
    if (!taskStart) return [];
    const taskRowIndex = rowIndexByTaskId.get(task.id);
    if (taskRowIndex === undefined) return [];

    return task.dependencies.flatMap((dependency) => {
      const predecessor = taskById.get(dependency.dependsOnTaskId);
      if (!predecessor?.startDate || !predecessor.dueDate) return [];
      const predecessorEnd = parseDate(predecessor.dueDate);
      const predecessorStart = parseDate(predecessor.startDate);
      if (!predecessorEnd || !predecessorStart) return [];
      const predecessorRowIndex = rowIndexByTaskId.get(predecessor.id);
      if (predecessorRowIndex === undefined) return [];

      const predecessorAnchor =
        dependency.type === "start-to-start" || dependency.type === "start-to-finish"
          ? predecessorStart
          : predecessorEnd;
      const successorAnchor =
        dependency.type === "finish-to-finish" || dependency.type === "start-to-finish"
          ? parseDate(task.dueDate)
          : taskStart;

      if (!successorAnchor) return [];

      const sourceX =
        diffInDays(rangeStart, predecessorAnchor) * dayWidth +
        (dependency.type === "start-to-start" || dependency.type === "start-to-finish" ? 8 : dayWidth - 8);
      const targetX =
        diffInDays(rangeStart, successorAnchor) * dayWidth +
        (dependency.type === "finish-to-finish" || dependency.type === "start-to-finish" ? dayWidth - 8 : 8);
      const sourceY = predecessorRowIndex * TASK_ROW_HEIGHT + TASK_ROW_HEIGHT / 2;
      const targetY = taskRowIndex * TASK_ROW_HEIGHT + TASK_ROW_HEIGHT / 2;
      const bendX = sourceX + Math.max(16, (targetX - sourceX) / 2);

      return [
        {
          key: `${task.id}-${dependency.dependsOnTaskId}-${dependency.type}`,
          path: `M ${sourceX} ${sourceY} L ${bendX} ${sourceY} L ${bendX} ${targetY} L ${targetX} ${targetY}`,
        },
      ];
    });
  });

  return (
    <section className="floating-panel rounded-lg border border-[var(--panel-border)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Gantt roadmap
          </div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">
            Today line, typed dependencies, progress bars, and milestone markers on one project timeline.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["weeks", "months", "quarters"] as GanttZoom[]).map((value) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded-md border px-3 py-2 text-sm transition-colors",
                zoom === value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--foreground)]"
              )}
              onClick={() => onZoomChange(value)}
            >
              {ZOOM_CONFIG[value].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 gap-0 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-[var(--panel-border)] xl:border-b-0 xl:border-r">
          <div className="grid h-[70px] grid-cols-[minmax(0,1fr)_88px] items-end gap-3 border-b border-[var(--panel-border)] px-5 pb-3 pt-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Tasks
              </div>
            </div>
            <div className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Status
            </div>
          </div>

          <div>
            {scheduledTasks.map((task) => {
              const column = project.columns.find((entry) => entry.id === task.columnId);
              const isSelected = selectedTaskId === task.id;
              return (
                <button
                  key={task.id}
                  type="button"
                  className={cn(
                    "grid h-[54px] w-full grid-cols-[minmax(0,1fr)_88px] items-center gap-3 border-b border-[var(--panel-border)] px-5 text-left transition-colors",
                    isSelected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-hover)]"
                  )}
                  onClick={() => onSelectTask(task.id)}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{task.name}</div>
                    <div className="truncate text-xs text-[var(--text-muted)]">
                      {task.assignee || "Unassigned"} • {formatCompactDate(task.startDate)} to {formatCompactDate(task.dueDate)}
                    </div>
                  </div>
                  <div className="text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                    {column?.name ?? task.columnId}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto">
          <div style={{ minWidth: timelineWidth }}>
            <div className="sticky top-0 z-20 border-b border-[var(--panel-border)] bg-[var(--panel-bg)]">
              <div className="relative h-[38px] border-b border-[var(--panel-border)]">
                {monthSpans.map((month) => (
                  <div
                    key={month.key}
                    className="absolute top-0 flex h-full items-center border-r border-[var(--panel-border)] px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]"
                    style={{ left: month.left, width: month.width }}
                  >
                    {month.label}
                  </div>
                ))}
              </div>

              <div className="relative h-[32px]">
                {days.map((day, index) => (
                  <div
                    key={dateKey(day)}
                    className="absolute top-0 flex h-full items-center justify-center border-r border-[var(--panel-border)] text-[11px] text-[var(--text-muted)]"
                    style={{ left: index * dayWidth, width: dayWidth }}
                  >
                    {day.getUTCDate()}
                  </div>
                ))}
                {todayOffset >= 0 && todayOffset < totalDays && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-30 w-px bg-[var(--danger)]"
                    style={{ left: todayOffset * dayWidth + dayWidth / 2 }}
                  />
                )}
              </div>
            </div>

            <div
              className="relative"
              style={{
                height: Math.max(scheduledTasks.length * TASK_ROW_HEIGHT, TASK_ROW_HEIGHT),
                backgroundImage: `
                  linear-gradient(to bottom, transparent ${TASK_ROW_HEIGHT - 1}px, var(--panel-border) ${TASK_ROW_HEIGHT - 1}px),
                  linear-gradient(to right, transparent ${dayWidth - 1}px, var(--panel-border) ${dayWidth - 1}px)
                `,
                backgroundSize: `${timelineWidth}px ${TASK_ROW_HEIGHT}px, ${dayWidth}px 100%`,
              }}
            >
              {scheduledTasks.map((task, rowIndex) => {
                const start = parseDate(task.startDate);
                const end = parseDate(task.dueDate);
                if (!start || !end) return null;
                const left = diffInDays(rangeStart, start) * dayWidth + 4;
                const width = Math.max((diffInDays(start, end) + 1) * dayWidth - 8, 14);
                const accent = taskAccent(task, project);
                const isSelected = selectedTaskId === task.id;
                const isMilestone =
                  Boolean(task.metadata.isMilestone) ||
                  (task.startDate && task.dueDate && task.startDate === task.dueDate);

                return (
                  <button
                    key={task.id}
                    type="button"
                    className="absolute left-0 right-0 block h-[54px] text-left"
                    style={{ top: rowIndex * TASK_ROW_HEIGHT }}
                    onClick={() => onSelectTask(task.id)}
                  >
                    <div
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 rounded-full transition-all",
                        isSelected ? "ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[var(--panel-bg)]" : ""
                      )}
                      style={{
                        left,
                        width: isMilestone ? TASK_BAR_HEIGHT : width,
                        height: TASK_BAR_HEIGHT,
                        background: isMilestone
                          ? "transparent"
                          : `color-mix(in srgb, ${accent} 22%, var(--surface-raised))`,
                        border: isMilestone ? "none" : `1px solid color-mix(in srgb, ${accent} 64%, transparent)`,
                      }}
                    >
                      {isMilestone ? (
                        <div
                          style={{
                            width: TASK_BAR_HEIGHT,
                            height: TASK_BAR_HEIGHT,
                            background: accent,
                            transform: "rotate(45deg)",
                            borderRadius: 4,
                            marginInline: "auto",
                          }}
                        />
                      ) : (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${Math.max(0, Math.min(100, task.progress))}%`,
                              background: accent,
                            }}
                          />
                          <div className="absolute inset-0 flex items-center px-3 text-[11px] font-semibold text-[var(--foreground)]">
                            <span className="truncate">
                              {task.progress}% {task.name}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}

              {dependencyLines.length > 0 && (
                <svg
                  className="pointer-events-none absolute inset-0 z-20"
                  width={timelineWidth}
                  height={Math.max(scheduledTasks.length * TASK_ROW_HEIGHT, TASK_ROW_HEIGHT)}
                  viewBox={`0 0 ${timelineWidth} ${Math.max(scheduledTasks.length * TASK_ROW_HEIGHT, TASK_ROW_HEIGHT)}`}
                  fill="none"
                >
                  <defs>
                    <marker
                      id="gantt-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="4"
                      orient="auto"
                    >
                      <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--text-muted)" />
                    </marker>
                  </defs>
                  {dependencyLines.map((line) => (
                    <path
                      key={line.key}
                      d={line.path}
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      markerEnd="url(#gantt-arrow)"
                      opacity="0.75"
                    />
                  ))}
                </svg>
              )}
            </div>
          </div>
        </div>
      </div>

      {unscheduledTasks.length > 0 && (
        <div className="border-t border-[var(--panel-border)] px-5 py-4">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Needs dates
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {unscheduledTasks.map((task) => (
              <button
                key={task.id}
                type="button"
                className={cn(
                  "rounded-md border px-4 py-3 text-left transition-colors",
                  selectedTaskId === task.id
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)]"
                )}
                onClick={() => onSelectTask(task.id)}
              >
                <div className="text-sm font-medium text-[var(--foreground)]">{task.name}</div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  Add start and due dates to place this task on the timeline.
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--panel-border)] px-5 py-4 text-xs text-[var(--text-muted)]">
        <span>Today: {formatDayLabel(todayUtc)}</span>
        <span>{project.taskCount} total tasks</span>
        <span>{project.dependencyCount} dependencies</span>
        <span>{project.completedTaskCount} complete</span>
      </div>
    </section>
  );
}
