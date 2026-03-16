"use client";

import { useState, useMemo } from "react";
import type { KanbanProject } from "@/lib/projectTypes";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";

interface KanbanCalendarViewProps {
  project: KanbanProject;
  onSelectTask?: (taskId: string) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function KanbanCalendarView({ project, onSelectTask }: KanbanCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof project.tasks>();
    for (const task of project.tasks) {
      if (!task.dueDate) continue;
      const group = map.get(task.dueDate) ?? [];
      group.push(task);
      map.set(task.dueDate, group);
    }
    return map;
  }, [project.tasks]);

  const getEpic = (epicId: string) => project.epics.find((e) => e.id === epicId);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Month navigation */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={prevMonth} style={navBtnStyle}>←</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--foreground)", minWidth: 160, textAlign: "center" }}>
            {currentDate.toLocaleDateString("en", { month: "long", year: "numeric" })}
          </span>
          <button onClick={nextMonth} style={navBtnStyle}>→</button>
        </div>
        <button onClick={goToday} style={{ ...navBtnStyle, padding: "4px 12px", fontSize: 12 }}>
          Today
        </button>
      </div>

      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        {WEEKDAYS.map((day) => (
          <div key={day} style={{ padding: "6px 8px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gridAutoRows: "1fr", overflow: "auto" }}>
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} style={{ borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", background: "rgba(0,0,0,0.02)" }} />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = tasksByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isWeekend = (i % 7 === 0) || (i % 7 === 6);

          return (
            <div
              key={dateStr}
              style={{
                borderRight: "1px solid var(--border)",
                borderBottom: "1px solid var(--border)",
                padding: 4,
                minHeight: 80,
                background: isToday ? "var(--accent-muted, rgba(59,130,246,0.06))" : isWeekend ? "rgba(0,0,0,0.015)" : undefined,
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: isToday ? 800 : 500,
                color: isToday ? "var(--accent)" : "var(--text-muted)",
                marginBottom: 4, textAlign: "right", paddingRight: 4,
              }}>
                {day}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {dayTasks.slice(0, 3).map((task) => {
                  const epic = getEpic(task.epicId);
                  const priorityCfg = PRIORITY_CONFIG[task.priority];
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask?.(task.id)}
                      style={{
                        fontSize: 10, padding: "2px 5px", borderRadius: 4,
                        background: `${epic?.color ?? priorityCfg.color}15`,
                        borderLeft: `2px solid ${epic?.color ?? priorityCfg.color}`,
                        color: "var(--foreground)", overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        cursor: onSelectTask ? "pointer" : undefined,
                        transition: "filter 0.12s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                    >
                      {task.name}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div style={{ fontSize: 9, color: "var(--text-muted)", textAlign: "center" }}>
                    +{dayTasks.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--foreground)",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};
