"use client";

import type { KanbanProject, KanbanViewMode } from "@/lib/projectTypes";
import { KanbanSquare, BarChart3, Calendar, Grid3X3, Timer, ArrowRight } from "lucide-react";
import { useMemo } from "react";

interface ProjectOverviewProps {
  project: KanbanProject;
  onNavigate: (view: KanbanViewMode) => void;
}

const TOOL_CARDS: {
  key: KanbanViewMode;
  label: string;
  description: string;
  icon: typeof KanbanSquare;
  color: string;
  gradient: string;
}[] = [
  {
    key: "kanban",
    label: "Kanban Board",
    description: "Organize tasks across columns with drag-and-drop. Track work from backlog to done.",
    icon: KanbanSquare,
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f620, #3b82f608)",
  },
  {
    key: "gantt",
    label: "Gantt Chart",
    description: "Visualize task timelines and track progress with a horizontal bar chart.",
    icon: BarChart3,
    color: "#f59e0b",
    gradient: "linear-gradient(135deg, #f59e0b20, #f59e0b08)",
  },
  {
    key: "calendar",
    label: "Calendar",
    description: "View tasks on a monthly calendar to plan deadlines and milestones.",
    icon: Calendar,
    color: "#22c55e",
    gradient: "linear-gradient(135deg, #22c55e20, #22c55e08)",
  },
  {
    key: "matrix",
    label: "Priority Matrix",
    description: "Eisenhower-style matrix to prioritize tasks by urgency and importance.",
    icon: Grid3X3,
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf620, #8b5cf608)",
  },
  {
    key: "sessions",
    label: "Focus Sessions",
    description: "Group tasks into work sessions and track pomodoros for deep focus.",
    icon: Timer,
    color: "#06b6d4",
    gradient: "linear-gradient(135deg, #06b6d420, #06b6d408)",
  },
];

export default function ProjectOverview({ project, onNavigate }: ProjectOverviewProps) {
  const stats = useMemo(() => {
    const total = project.tasks.length;
    const withDates = project.tasks.filter((t) => t.startDate && t.dueDate).length;
    const doneCol = project.columns.find((c) => c.id === "done");
    const done = doneCol ? project.tasks.filter((t) => t.columnId === doneCol.id).length : 0;
    const inProgress = project.tasks.filter((t) => t.columnId === "in-progress" || t.columnId === "review").length;
    const sessions = project.sessions?.length ?? 0;
    const pomodoros = project.sessions?.reduce((sum, s) => sum + s.pomodorosCompleted, 0) ?? 0;
    return { total, withDates, done, inProgress, sessions, pomodoros };
  }, [project]);

  const getSubtext = (key: KanbanViewMode): string => {
    switch (key) {
      case "kanban":
        return `${stats.total} tasks · ${stats.inProgress} in progress · ${stats.done} done`;
      case "gantt":
        return `${stats.withDates} tasks with date ranges`;
      case "calendar":
        return `${stats.withDates} scheduled tasks`;
      case "matrix":
        return `${stats.total - stats.done} active tasks to prioritize`;
      case "sessions":
        return `${stats.sessions} sessions · ${stats.pomodoros} pomodoros`;
      default:
        return "";
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 32 }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
          {project.name}
        </h2>
        {project.description && (
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5 }}>
            {project.description}
          </p>
        )}
        <div style={{ marginTop: 12, display: "flex", gap: 12, justifyContent: "center", fontSize: 13, color: "var(--text-muted)" }}>
          <span>{stats.total} tasks</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>{project.epics.length} epics</span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span>{project.columns.length} columns</span>
        </div>
      </div>

      {/* Tool cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 16,
          width: "100%",
          maxWidth: 960,
        }}
      >
        {TOOL_CARDS.map(({ key, label, description, icon: Icon, color, gradient }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            style={{
              background: gradient,
              border: `1px solid ${color}25`,
              borderRadius: 14,
              padding: 24,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              transition: "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${color}50`;
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = `0 8px 24px ${color}15`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = `${color}25`;
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: `${color}18`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon size={22} style={{ color }} />
            </div>

            {/* Label + description */}
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)", display: "flex", alignItems: "center", gap: 8 }}>
                {label}
                <ArrowRight size={14} style={{ color: "var(--text-subtle)", opacity: 0.5 }} />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 4 }}>
                {description}
              </div>
            </div>

            {/* Stats subtext */}
            <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: "auto" }}>
              {getSubtext(key)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
