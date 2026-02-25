"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import type { GanttTask, ViewMode } from "@/lib/ganttTypes";
import { STATUS_CONFIG, PRIORITY_CONFIG, LINK_TYPE_CONFIG, getTaskColor, getTaskDurationDays } from "@/lib/ganttTypes";
import { useGanttStore } from "@/store/ganttStore";

// ─── Constants ──────────────────────────────────────────────────────
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 56;
const TASK_BAR_HEIGHT = 28;
const TASK_BAR_RADIUS = 6;
const LEFT_PANEL_WIDTH = 380;
const MIN_COL_WIDTH: Record<ViewMode, number> = { day: 40, week: 80, month: 120 };

// ─── Date Helpers ───────────────────────────────────────────────────
function parseDate(s: string): Date {
  const d = new Date(s + "T00:00:00");
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date, mode: "short" | "full" = "short"): string {
  if (mode === "full") {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay() + 1); // Monday
  return r;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthName(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ─── Timeline Column Generation ────────────────────────────────────
interface TimelineColumn {
  date: Date;
  label: string;
  isToday: boolean;
  isWeekend: boolean;
  isFirstOfMonth: boolean;
}

function generateColumns(start: Date, end: Date, mode: ViewMode): TimelineColumn[] {
  const cols: TimelineColumn[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (mode === "day") {
    let cur = new Date(start);
    while (cur <= end) {
      cols.push({
        date: new Date(cur),
        label: cur.getDate().toString(),
        isToday: cur.getTime() === today.getTime(),
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
        isFirstOfMonth: cur.getDate() === 1,
      });
      cur = addDays(cur, 1);
    }
  } else if (mode === "week") {
    let cur = startOfWeek(new Date(start));
    while (cur <= end) {
      const weekEnd = addDays(cur, 6);
      cols.push({
        date: new Date(cur),
        label: `${formatDate(cur)} – ${formatDate(weekEnd)}`,
        isToday: today >= cur && today <= weekEnd,
        isWeekend: false,
        isFirstOfMonth: cur.getDate() <= 7,
      });
      cur = addDays(cur, 7);
    }
  } else {
    let cur = startOfMonth(new Date(start));
    while (cur <= end) {
      const nextMonth = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      cols.push({
        date: new Date(cur),
        label: getMonthName(cur),
        isToday: today.getFullYear() === cur.getFullYear() && today.getMonth() === cur.getMonth(),
        isWeekend: false,
        isFirstOfMonth: true,
      });
      cur = nextMonth;
    }
  }
  return cols;
}

// ─── Group Tasks ────────────────────────────────────────────────────
interface TaskGroup {
  name: string;
  tasks: GanttTask[];
}

function groupTasks(tasks: GanttTask[]): TaskGroup[] {
  const groups = new Map<string, GanttTask[]>();
  const noGroup: GanttTask[] = [];

  for (const task of tasks) {
    if (task.group) {
      const list = groups.get(task.group) ?? [];
      list.push(task);
      groups.set(task.group, list);
    } else {
      noGroup.push(task);
    }
  }

  const result: TaskGroup[] = [];
  for (const [name, tasks] of groups) {
    result.push({ name, tasks });
  }
  if (noGroup.length > 0) {
    result.push({ name: "", tasks: noGroup });
  }
  return result;
}

// ─── Tooltip ────────────────────────────────────────────────────────
function TaskTooltip({ task, x, y }: { task: GanttTask; x: number; y: number }) {
  const status = STATUS_CONFIG[task.status];
  const priority = PRIORITY_CONFIG[task.priority];

  return (
    <div
      style={{
        position: "fixed",
        left: x + 12,
        top: y - 8,
        zIndex: 9999,
        background: "var(--panel-bg)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "12px 16px",
        minWidth: 260,
        maxWidth: 360,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        fontSize: 12,
        pointerEvents: "none",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{task.name}</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 6, color: "var(--text-muted)" }}>
        <span>{formatDate(parseDate(task.startDate), "full")} → {formatDate(parseDate(task.endDate), "full")}</span>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <span style={{ background: status.color + "22", color: status.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
          {status.icon} {status.label}
        </span>
        <span style={{ background: priority.color + "22", color: priority.color, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
          {priority.icon} {priority.label}
        </span>
      </div>
      {task.assignee && (
        <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>
          👤 {task.assignee}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
        <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${task.progress}%`, height: "100%", background: status.color, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600 }}>{task.progress}%</span>
      </div>
      {task.links.length > 0 && (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {task.links.map((link, i) => {
            const cfg = LINK_TYPE_CONFIG[link.type];
            return (
              <span key={i} style={{ fontSize: 10, color: cfg.color, fontWeight: 500 }}>
                {cfg.icon} {link.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function GanttChartView() {
  const chart = useGanttStore((s) => s.chart);
  const selectedTaskId = useGanttStore((s) => s.selectedTaskId);
  const selectTask = useGanttStore((s) => s.selectTask);
  const updateTask = useGanttStore((s) => s.updateTask);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [tooltip, setTooltip] = useState<{ task: GanttTask; x: number; y: number } | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sync horizontal scroll between header + body
  const handleScroll = useCallback(() => {
    if (scrollRef.current && timelineRef.current) {
      timelineRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  const tasks = chart?.tasks ?? [];

  // Calculate timeline bounds with padding
  const { timelineStart, timelineEnd, columns } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const start = addDays(today, -7);
      const end = addDays(today, 60);
      return { timelineStart: start, timelineEnd: end, columns: generateColumns(start, end, viewMode) };
    }

    const dates = tasks.flatMap((t) => [parseDate(t.startDate), parseDate(t.endDate)]);
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const padding = viewMode === "month" ? 30 : viewMode === "week" ? 14 : 7;
    const start = addDays(minDate, -padding);
    const end = addDays(maxDate, padding);

    return { timelineStart: start, timelineEnd: end, columns: generateColumns(start, end, viewMode) };
  }, [tasks, viewMode]);

  const colWidth = MIN_COL_WIDTH[viewMode];
  const totalWidth = columns.length * colWidth;

  // Build display rows (with group headers)
  const groups = useMemo(() => groupTasks(tasks), [tasks]);
  const displayRows = useMemo(() => {
    const rows: Array<{ type: "group"; name: string } | { type: "task"; task: GanttTask }> = [];
    for (const group of groups) {
      if (group.name) {
        rows.push({ type: "group", name: group.name });
        if (!collapsedGroups.has(group.name)) {
          for (const task of group.tasks) {
            rows.push({ type: "task", task });
          }
        }
      } else {
        for (const task of group.tasks) {
          rows.push({ type: "task", task });
        }
      }
    }
    return rows;
  }, [groups, collapsedGroups]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && columns.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOffset = diffDays(timelineStart, today);
      const scrollTarget = dayOffset * (colWidth / (viewMode === "day" ? 1 : viewMode === "week" ? 7 : 30)) - 200;
      scrollRef.current.scrollLeft = Math.max(0, scrollTarget);
    }
  }, [columns.length, timelineStart, colWidth, viewMode]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Calculate task bar position
  const getTaskBarStyle = (task: GanttTask) => {
    const start = parseDate(task.startDate);
    const end = parseDate(task.endDate);
    const offsetDays = diffDays(timelineStart, start);
    const durationDays = diffDays(start, end) + 1;

    let left: number, width: number;
    if (viewMode === "day") {
      left = offsetDays * colWidth;
      width = durationDays * colWidth;
    } else if (viewMode === "week") {
      left = (offsetDays / 7) * colWidth;
      width = (durationDays / 7) * colWidth;
    } else {
      // approx month
      left = (offsetDays / 30) * colWidth;
      width = (durationDays / 30) * colWidth;
    }

    return { left: Math.max(0, left), width: Math.max(colWidth * 0.3, width) };
  };

  // Today line position
  const todayLineX = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offsetDays = diffDays(timelineStart, today);
    if (viewMode === "day") return offsetDays * colWidth + colWidth / 2;
    if (viewMode === "week") return (offsetDays / 7) * colWidth;
    return (offsetDays / 30) * colWidth;
  }, [timelineStart, colWidth, viewMode]);

  if (!chart) return null;

  // ─── Month headers for day view ─────────────────────────────────
  const monthHeaders = useMemo(() => {
    if (viewMode !== "day") return [];
    const months: Array<{ label: string; startIdx: number; span: number }> = [];
    let currentMonth = "";
    let startIdx = 0;
    for (let i = 0; i < columns.length; i++) {
      const m = getMonthName(columns[i].date);
      if (m !== currentMonth) {
        if (currentMonth) {
          months.push({ label: currentMonth, startIdx, span: i - startIdx });
        }
        currentMonth = m;
        startIdx = i;
      }
    }
    if (currentMonth) {
      months.push({ label: currentMonth, startIdx, span: columns.length - startIdx });
    }
    return months;
  }, [columns, viewMode]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--background)", color: "var(--foreground)" }}>
      {/* Modern Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-bg)",
          flexShrink: 0,
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0, letterSpacing: "-0.01em" }}>Timeline</h2>
          <div style={{ height: 20, width: 1, background: "var(--border)" }}></div>
          <div style={{ display: "flex", background: "var(--surface)", padding: 3, borderRadius: 8, border: "1px solid var(--border)", gap: 2 }}>
            {(["day", "week", "month"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: viewMode === m ? "var(--accent)" : "transparent",
                  color: viewMode === m ? "#fff" : "var(--text-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  boxShadow: viewMode === m ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.15s ease",
                  letterSpacing: "-0.01em",
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== m) {
                    e.currentTarget.style.background = "var(--surface-hover)";
                    e.currentTarget.style.color = "var(--foreground)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== m) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-muted)";
                  }
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, display: "flex", alignItems: "center", gap: 12 }}>
          <span>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: "var(--success)" }}>
            {tasks.filter((t) => t.status === "completed").length} completed
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left panel — task list */}
        <div
          style={{
            width: LEFT_PANEL_WIDTH,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflow: "auto",
            background: "var(--panel-bg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Left panel header - Modern styling */}
          <div
            style={{
              height: HEADER_HEIGHT + (viewMode === "day" ? 24 : 0),
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              padding: "0 20px",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-subtle)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: "var(--surface)",
            }}
          >
            <span style={{ flex: 1 }}>Task</span>
            <span style={{ width: 80, textAlign: "center" }}>Status</span>
            <span style={{ width: 60, textAlign: "center" }}>Progress</span>
          </div>

          {/* Task rows */}
          <div style={{ flex: 1 }}>
            {displayRows.map((row) => {
              if (row.type === "group") {
                return (
                  <div
                    key={`group-${row.name}`}
                    onClick={() => toggleGroup(row.name)}
                    style={{
                      height: ROW_HEIGHT,
                      display: "flex",
                      alignItems: "center",
                      padding: "0 20px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--foreground)",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                      background: "var(--surface)",
                      userSelect: "none",
                      transition: "background 0.15s ease",
                      letterSpacing: "-0.01em",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "var(--surface)"}
                  >
                    <span style={{ marginRight: 10, fontSize: 11, color: "var(--text-muted)", width: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {collapsedGroups.has(row.name) ? "▶" : "▼"}
                    </span>
                    {row.name}
                    <span style={{ marginLeft: 10, fontSize: 12, color: "var(--text-subtle)", fontWeight: 500, background: "var(--border)", padding: "2px 8px", borderRadius: 12 }}>
                      {groups.find((g) => g.name === row.name)?.tasks.length ?? 0}
                    </span>
                  </div>
                );
              }

              const task = row.task;
              const status = STATUS_CONFIG[task.status];
              const isSelected = selectedTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  style={{
                    height: ROW_HEIGHT,
                    display: "flex",
                    alignItems: "center",
                    padding: "0 20px",
                    fontSize: 13,
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    background: isSelected ? "var(--accent-soft)" : "transparent",
                    borderLeft: isSelected ? `3px solid var(--accent)` : "3px solid transparent",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "var(--surface-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Priority indicator */}
                  <div
                    style={{
                      width: 18,
                      display: "flex",
                      justifyContent: "center",
                      marginRight: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: PRIORITY_CONFIG[task.priority].color,
                        boxShadow: `0 0 8px ${PRIORITY_CONFIG[task.priority].color}40`,
                      }}
                    />
                  </div>
                  {/* Task name */}
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontWeight: 500,
                      textDecoration: task.status === "cancelled" ? "line-through" : "none",
                      opacity: task.status === "cancelled" ? 0.5 : 1,
                      color: isSelected ? "var(--accent)" : "var(--foreground)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {task.name}
                  </span>
                  {/* Links indicator */}
                  {task.links.length > 0 && (
                    <span style={{ fontSize: 11, marginRight: 10, opacity: 0.6, display: "flex", alignItems: "center", gap: 4, color: "var(--text-subtle)" }}>
                      <span style={{ fontSize: 13 }}>🔗</span>{task.links.length}
                    </span>
                  )}
                  {/* Status badge */}
                  <div
                    style={{
                      width: 80,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: status.color,
                      background: status.color + "18",
                      padding: "3px 10px",
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      minWidth: 75,
                      justifyContent: "center",
                      letterSpacing: "-0.01em",
                    }}>
                      {status.icon} <span>{status.label}</span>
                    </span>
                  </div>
                  {/* Progress */}
                  <div style={{ width: 60, display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="var(--border)"
                        strokeWidth="3.5"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={status.color}
                        strokeWidth="3.5"
                        strokeDasharray={`${task.progress}, 100`}
                      />
                    </svg>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", minWidth: 28, fontWeight: 500 }}>
                      {task.progress}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel — timeline */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Timeline header */}
          <div
            ref={timelineRef}
            style={{
              overflow: "hidden",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
              background: "var(--surface)",
            }}
          >
            {/* Month row (day view only) — Modern styling */}
            {viewMode === "day" && monthHeaders.length > 0 && (
              <div style={{ display: "flex", height: 24, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
                {monthHeaders.map((mh) => (
                  <div
                    key={mh.label}
                    style={{
                      width: mh.span * colWidth,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--text-subtle)",
                      borderRight: "1px solid var(--border)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {mh.label}
                  </div>
                ))}
              </div>
            )}
            {/* Column headers — Modern styling */}
            <div style={{ display: "flex", height: HEADER_HEIGHT }}>
              {columns.map((col, i) => (
                <div
                  key={i}
                  style={{
                    width: colWidth,
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: col.isToday ? 600 : 500,
                    color: col.isToday ? "var(--accent)" : "var(--text-muted)",
                    borderRight: "1px solid var(--border)",
                    background: col.isToday ? "var(--accent-soft)" : col.isWeekend ? "var(--surface-hover)" : "transparent",
                    transition: "background 0.15s ease",
                  }}
                >
                  {viewMode === "day" && (
                    <span style={{ fontSize: 10, opacity: 0.7, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {col.date.toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </span>
                  )}
                  <span style={{ letterSpacing: "-0.01em" }}>{col.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline body */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflow: "auto",
              position: "relative",
            }}
          >
            <div style={{ width: totalWidth, position: "relative" }}>
              {/* Grid lines */}
              <svg
                style={{ position: "absolute", top: 0, left: 0, width: totalWidth, height: displayRows.length * ROW_HEIGHT, pointerEvents: "none" }}
              >
                {/* Vertical grid */}
                {columns.map((col, i) => (
                  <line
                    key={i}
                    x1={i * colWidth}
                    y1={0}
                    x2={i * colWidth}
                    y2={displayRows.length * ROW_HEIGHT}
                    stroke={col.isFirstOfMonth ? "var(--border)" : "var(--dot-color)"}
                    strokeWidth={1}
                    strokeDasharray={col.isFirstOfMonth ? "" : "4 4"}
                  />
                ))}
                {/* Horizontal grid */}
                {displayRows.map((_, i) => (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={i * ROW_HEIGHT}
                    x2={totalWidth}
                    y2={i * ROW_HEIGHT}
                    stroke="var(--dot-color)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                ))}
                {/* Weekend columns (day view) */}
                {viewMode === "day" &&
                  columns.map((col, i) =>
                    col.isWeekend ? (
                      <rect
                        key={`we-${i}`}
                        x={i * colWidth}
                        y={0}
                        width={colWidth}
                        height={displayRows.length * ROW_HEIGHT}
                        fill="var(--background)"
                        opacity={0.6}
                      />
                    ) : null
                  )}
                {/* Today line */}
                {todayLineX > 0 && todayLineX < totalWidth && (
                  <>
                    <line
                      x1={todayLineX}
                      y1={0}
                      x2={todayLineX}
                      y2={displayRows.length * ROW_HEIGHT}
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                    />
                    <circle cx={todayLineX} cy={0} r={3} fill="var(--accent)" />
                  </>
                )}
              </svg>

              {/* Task bars */}
              {displayRows.map((row, rowIdx) => {
                if (row.type === "group") {
                  return (
                    <div
                      key={`group-bar-${row.name}`}
                      style={{
                        position: "absolute",
                        top: rowIdx * ROW_HEIGHT,
                        left: 0,
                        width: totalWidth,
                        height: ROW_HEIGHT,
                        background: "var(--surface)",
                        opacity: 0.5,
                      }}
                    />
                  );
                }

                const task = row.task;
                const { left, width } = getTaskBarStyle(task);
                const color = getTaskColor(task);
                const isSelected = selectedTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    style={{
                      position: "absolute",
                      top: rowIdx * ROW_HEIGHT + (ROW_HEIGHT - 28) / 2,
                      left,
                      width,
                      height: 28,
                      borderRadius: 6,
                      background: color,
                      border: isSelected ? `2px solid var(--foreground)` : `1px solid rgba(255,255,255,0.15)`,
                      boxShadow: isSelected
                        ? `0 0 0 3px var(--accent-soft), 0 4px 12px rgba(0,0,0,0.25)`
                        : `0 2px 6px rgba(0,0,0,0.15)`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      overflow: "hidden",
                      transition: "all 0.15s ease",
                      zIndex: isSelected ? 10 : 1,
                    }}
                    onClick={() => selectTask(task.id)}
                    onMouseEnter={(e) => {
                      setTooltip({ task, x: e.clientX, y: e.clientY });
                      if (!isSelected) {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.25)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      setTooltip(null);
                      if (!isSelected) {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
                      }
                    }}
                    onMouseMove={(e) => tooltip && setTooltip({ task, x: e.clientX, y: e.clientY })}
                  >
                    {/* Progress fill */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: `${task.progress}%`,
                        height: "100%",
                        background: "rgba(255,255,255,0.2)",
                        boxShadow: "inset -1px 0 1px rgba(255,255,255,0.3)",
                        borderRadius: "6px 0 0 6px",
                      }}
                    />
                    {/* Task label */}
                    {width > 50 && (
                      <span
                        style={{
                          position: "relative",
                          zIndex: 1,
                          padding: "0 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          textShadow: "0 1px 3px rgba(0,0,0,0.4)",
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {task.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && <TaskTooltip task={tooltip.task} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
}
