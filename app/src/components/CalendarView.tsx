"use client";

import { useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import type { EventInput, EventClickArg, EventDropArg } from "@fullcalendar/core";
import { useGanttStore } from "@/store/ganttStore";
import { getTaskColor, STATUS_CONFIG } from "@/lib/ganttTypes";

// ─── Helpers: FullCalendar uses exclusive end dates for all-day events ─
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function subOneDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Custom event tile ───────────────────────────────────────────────
interface EventContentProps {
  eventInfo: {
    event: {
      title: string;
      extendedProps: {
        status: keyof typeof STATUS_CONFIG;
        progress: number;
        assignee?: string;
      };
    };
  };
}

function EventContent({ eventInfo }: EventContentProps) {
  const { status, progress, assignee } = eventInfo.event.extendedProps;
  const statusIcon = STATUS_CONFIG[status]?.icon ?? "";
  const initials = assignee
    ? assignee
      .split(" ")
      .map((n) => n[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : null;

  return (
    <div
      style={{
        padding: "2px 6px",
        fontSize: 11,
        lineHeight: 1.4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ flexShrink: 0 }}>{statusIcon}</span>
        <span
          style={{
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {eventInfo.event.title}
        </span>
      </div>
      {/* Progress row */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div
          style={{
            flex: 1,
            height: 3,
            background: "rgba(255,255,255,0.3)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "rgba(255,255,255,0.85)",
              borderRadius: 2,
            }}
          />
        </div>
        {initials && (
          <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0 }}>{initials}</span>
        )}
        <span style={{ fontSize: 10, opacity: 0.75, flexShrink: 0 }}>{progress}%</span>
      </div>
    </div>
  );
}

// ─── CalendarView ─────────────────────────────────────────────────────
export default function CalendarView() {
  const chart = useGanttStore((s) => s.chart);
  const updateTask = useGanttStore((s) => s.updateTask);
  const selectTask = useGanttStore((s) => s.selectTask);
  const calendarRef = useRef<FullCalendar>(null);

  // Derive FullCalendar events from the shared Gantt store (single source of truth)
  const events: EventInput[] = (chart?.tasks ?? []).map((task) => {
    const color = getTaskColor(task);
    return {
      id: task.id,
      title: task.name,
      start: task.startDate,
      end: addOneDay(task.endDate), // FC exclusive end
      allDay: true,
      backgroundColor: color,
      borderColor: color,
      textColor: "#ffffff",
      extendedProps: {
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        assignee: task.assignee,
        description: task.description,
      },
    };
  });

  // Click a task → open the existing GanttTaskModal via shared store
  const handleEventClick = (info: EventClickArg) => {
    selectTask(info.event.id);
  };

  // Drag to new dates → update task in shared store (syncs Gantt view too)
  const handleEventDrop = (info: EventDropArg) => {
    const startStr = info.event.startStr;
    const endStr = info.event.endStr ? subOneDay(info.event.endStr) : startStr;
    updateTask(info.event.id, { startDate: startStr, endDate: endStr });
  };

  // Resize event → update task dates
  const handleEventResize = (info: EventResizeDoneArg) => {
    const startStr = info.event.startStr;
    const endStr = info.event.endStr ? subOneDay(info.event.endStr) : startStr;
    updateTask(info.event.id, { startDate: startStr, endDate: endStr });
  };

  if (!chart) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
        }}
      >
        No chart loaded
      </div>
    );
  }

  return (
    <div
      className="calendar-view-wrapper"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Theme integration styles */}
      <style>{`
        .calendar-view-wrapper .fc {
          flex: 1;
          height: 100%;
          font-family: inherit;
          --fc-border-color: var(--border);
          --fc-button-bg-color: var(--surface);
          --fc-button-border-color: var(--border);
          --fc-button-text-color: var(--foreground);
          --fc-button-hover-bg-color: var(--surface-hover);
          --fc-button-hover-border-color: var(--border);
          --fc-button-active-bg-color: var(--accent);
          --fc-button-active-border-color: var(--accent);
          --fc-button-active-text-color: var(--accent-foreground);
          --fc-event-border-color: transparent;
          --fc-today-bg-color: var(--accent-soft);
          --fc-neutral-bg-color: var(--panel-bg);
          --fc-page-bg-color: var(--background);
          --fc-list-event-hover-bg-color: var(--surface-hover);
          --fc-small-font-size: 11px;
        }
        .calendar-view-wrapper .fc-theme-standard td,
        .calendar-view-wrapper .fc-theme-standard th,
        .calendar-view-wrapper .fc-theme-standard .fc-scrollgrid {
          border-color: var(--border);
        }
        .calendar-view-wrapper .fc-col-header-cell {
          background: var(--panel-bg);
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 8px 0;
        }
        .calendar-view-wrapper .fc-daygrid-day-number {
          color: var(--text-muted);
          font-size: 12px;
          padding: 4px 8px;
          text-decoration: none;
        }
        .calendar-view-wrapper .fc-toolbar-title {
          font-size: 15px;
          font-weight: 700;
          color: var(--foreground);
        }
        .calendar-view-wrapper .fc-button {
          font-size: 12px !important;
          font-weight: 500 !important;
          padding: 5px 12px !important;
          border-radius: 6px !important;
          transition: background 0.15s, opacity 0.15s;
          outline: none !important;
          box-shadow: none !important;
        }
        .calendar-view-wrapper .fc-button:focus-visible {
          outline: 2px solid var(--accent) !important;
          outline-offset: 1px;
        }
        .calendar-view-wrapper .fc-button-group .fc-button { border-radius: 0 !important; }
        .calendar-view-wrapper .fc-button-group .fc-button:first-child { border-radius: 6px 0 0 6px !important; }
        .calendar-view-wrapper .fc-button-group .fc-button:last-child  { border-radius: 0 6px 6px 0 !important; }
        .calendar-view-wrapper .fc-event {
          border-radius: 4px;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
        }
        .calendar-view-wrapper .fc-event:hover { opacity: 0.85; transform: translateY(-1px); }
        .calendar-view-wrapper .fc-scrollgrid,
        .calendar-view-wrapper .fc-daygrid-day { background: var(--background); }
        .calendar-view-wrapper .fc-daygrid-day:hover { background: var(--surface-hover); }
        .calendar-view-wrapper .fc-list-day-cushion {
          background: var(--panel-bg) !important;
          color: var(--text-muted);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .calendar-view-wrapper .fc-list-event:hover td { background: var(--surface-hover); }
        .calendar-view-wrapper .fc-list-event-title a { color: var(--foreground); text-decoration: none; }
        .calendar-view-wrapper .fc-list-event-dot { border-width: 5px; }
        .calendar-view-wrapper .fc-timegrid-slot { background: var(--background); border-color: var(--border); }
        .calendar-view-wrapper .fc-timegrid-axis { color: var(--text-muted); font-size: 11px; }
        .calendar-view-wrapper th.fc-timegrid-axis { background: var(--panel-bg); }
        .calendar-view-wrapper .fc-more-link { color: var(--accent); font-size: 11px; font-weight: 600; }
        .calendar-view-wrapper .fc-popover {
          background: var(--panel-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: var(--card-shadow-hover);
        }
        .calendar-view-wrapper .fc-popover-header {
          background: var(--surface);
          color: var(--foreground);
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px 8px 0 0;
          padding: 8px 12px;
        }
        .calendar-view-wrapper .fc-popover-close { color: var(--text-muted); }
        .calendar-view-wrapper .fc-daygrid-day.fc-day-today { background: var(--accent-soft) !important; }
      `}</style>

      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listMonth",
        }}
        buttonText={{
          today: "Today",
          month: "Month",
          week: "Week",
          list: "Agenda",
        }}
        events={events}
        editable={true}
        droppable={false}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        eventContent={(info) => (
          <EventContent
            eventInfo={{
              event: {
                title: info.event.title,
                extendedProps: info.event.extendedProps as EventContentProps["eventInfo"]["event"]["extendedProps"],
              },
            }}
          />
        )}
        dayMaxEvents={4}
        weekends={true}
        fixedWeekCount={false}
        height="100%"
        eventDisplay="block"
        nowIndicator={true}
      />
    </div>
  );
}
