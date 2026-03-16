"use client";

import { useState, useMemo } from "react";
import type { KanbanProject } from "@/lib/projectTypes";
import type { CreateItemDefaults } from "./CreateItemModal";
import { PRIORITY_CONFIG } from "@/lib/projectTypes";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface KanbanCalendarViewProps {
  project: KanbanProject;
  onSelectTask?: (taskId: string) => void;
  onRequestCreate?: (defaults?: CreateItemDefaults) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function KanbanCalendarView({ project, onSelectTask, onRequestCreate }: KanbanCalendarViewProps) {
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-bold text-[var(--foreground)] min-w-40 text-center">
            {currentDate.toLocaleDateString("en", { month: "long", year: "numeric" })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={goToday}>
          Today
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[var(--border)] shrink-0">
        {WEEKDAYS.map((day) => (
          <div key={day} className="px-2 py-1.5 text-[11px] font-bold text-[var(--text-muted)] text-center uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="border-r border-b border-[var(--border)] bg-[var(--surface-hover)]/20" />;
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTasks = tasksByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isWeekend = (i % 7 === 0) || (i % 7 === 6);

          return (
            <div
              key={dateStr}
              onClick={() => {
                if (dayTasks.length === 0 && onRequestCreate) {
                  onRequestCreate({ dueDate: dateStr });
                }
              }}
              className={cn(
                "border-r border-b border-[var(--border)] p-1.5 min-h-20 transition-colors duration-100",
                isToday && "bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent)]/30",
                !isToday && isWeekend && "bg-[var(--surface-hover)]/20",
                dayTasks.length === 0 && onRequestCreate && "cursor-pointer hover:bg-[var(--surface-hover)]/40"
              )}
            >
              <div className={cn(
                "text-xs text-right pr-1 mb-1",
                isToday ? "font-extrabold text-[var(--accent)]" : "font-medium text-[var(--text-muted)]"
              )}>
                {day}
              </div>
              <div className="flex flex-col gap-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const epic = getEpic(task.epicId);
                  const priorityCfg = PRIORITY_CONFIG[task.priority];
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask?.(task.id)}
                      className="text-[11px] px-1.5 py-0.5 rounded truncate text-[var(--foreground)] cursor-pointer transition-[filter] duration-150 hover:brightness-110"
                      style={{
                        background: `${epic?.color ?? priorityCfg.color}15`,
                        borderLeft: `2px solid ${epic?.color ?? priorityCfg.color}`,
                      }}
                    >
                      {task.name}
                    </div>
                  );
                })}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-[var(--text-muted)] text-center">
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
