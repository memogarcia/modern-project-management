"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useGanttStore } from "@/store/ganttStore";
import GanttChartView from "@/components/GanttChart";
import GanttTaskModal from "@/components/GanttTaskModal";
import type { GanttTask } from "@/lib/ganttTypes";
import { STATUS_CONFIG } from "@/lib/ganttTypes";
import { Calendar, LayoutDashboard, CalendarDays, AlertCircle } from "lucide-react";

// CalendarView uses FullCalendar which is browser-only — disable SSR
const CalendarView = dynamic(() => import("@/components/CalendarView"), {
  ssr: false, loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>Loading calendar...</div>
  )
});

type PageView = "gantt" | "calendar";

export default function GanttDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const chart = useGanttStore((s) => s.chart);
  const loadError = useGanttStore((s) => s.loadError);
  const persistError = useGanttStore((s) => s.persistError);
  const selectedTaskId = useGanttStore((s) => s.selectedTaskId);
  const loadChart = useGanttStore((s) => s.loadChart);
  const addTask = useGanttStore((s) => s.addTask);
  const updateTask = useGanttStore((s) => s.updateTask);
  const removeTask = useGanttStore((s) => s.removeTask);
  const selectTask = useGanttStore((s) => s.selectTask);
  const updateMeta = useGanttStore((s) => s.updateMeta);

  const [loading, setLoading] = useState(true);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaName, setMetaName] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [pageView, setPageView] = useState<PageView>(
    (searchParams.get("view") as PageView) || "gantt"
  );

  useEffect(() => {
    setLoading(true);
    void loadChart(id).finally(() => setLoading(false));
  }, [id, loadChart]);

  const selectedTask = useMemo(
    () => chart?.tasks.find((t) => t.id === selectedTaskId) ?? null,
    [chart, selectedTaskId]
  );

  // Stats
  const stats = useMemo(() => {
    if (!chart) return null;
    const tasks = chart.tasks;
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const inProgress = tasks.filter((t) => t.status === "in-progress").length;
    const blocked = tasks.filter((t) => t.status === "blocked").length;
    const avgProgress = total > 0 ? Math.round(tasks.reduce((sum, t) => sum + t.progress, 0) / total) : 0;
    return { total, completed, inProgress, blocked, avgProgress };
  }, [chart]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)" }}>
        Loading chart...
      </div>
    );
  }

  if (!chart) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, background: "var(--background)", color: "var(--text-muted)", gap: 16 }}>
        <AlertCircle size={48} style={{ color: "var(--text-muted)", opacity: 0.5 }} />
        <div>{loadError ?? "Gantt chart not found"}</div>
        <button
          onClick={() => router.push(pageView === "calendar" ? "/calendar" : "/gantt")}
          style={{ padding: "8px 16px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          ← Back to Charts
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--background)", color: "var(--foreground)", overflow: "hidden" }}>
      {/* Top bar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--panel-bg)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push(pageView === "calendar" ? "/calendar" : "/gantt")}
          style={{
            padding: "6px 10px",
            background: "transparent",
            color: "var(--text-muted)",
            border: "none",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {pageView === "calendar" ? "Calendar" : "Gantt Charts"}
        </button>
        <span style={{ color: "var(--border)", fontSize: "16px", fontWeight: 300 }}>/</span>

        {editingMeta ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <input
              value={metaName}
              onChange={(e) => setMetaName(e.target.value)}
              style={{
                padding: "4px 10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--foreground)",
                fontSize: 14,
                fontWeight: 700,
                outline: "none",
                width: 200,
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateMeta(metaName, metaDesc);
                  setEditingMeta(false);
                }
              }}
            />
            <input
              value={metaDesc}
              onChange={(e) => setMetaDesc(e.target.value)}
              style={{
                padding: "4px 10px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                color: "var(--text-muted)",
                fontSize: 12,
                outline: "none",
                flex: 1,
              }}
              placeholder="Description..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateMeta(metaName, metaDesc);
                  setEditingMeta(false);
                }
              }}
            />
            <button
              onClick={() => { updateMeta(metaName, metaDesc); setEditingMeta(false); }}
              style={{ padding: "4px 12px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }}
            >
              Save
            </button>
          </div>
        ) : (
          <div
            style={{ flex: 1, cursor: "pointer" }}
            onClick={() => { setMetaName(chart.name); setMetaDesc(chart.description); setEditingMeta(true); }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={18} style={{ color: "var(--accent)" }} /> {chart.name}
            </div>
            {chart.description && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{chart.description}</div>
            )}
          </div>
        )}

        {/* Stats pills */}
        {stats && stats.total > 0 && (
          <div style={{ display: "flex", gap: 6, marginRight: 8 }}>
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATUS_CONFIG["completed"].color + "20", color: STATUS_CONFIG["completed"].color }}>
              {stats.completed}/{stats.total} done
            </span>
            {stats.blocked > 0 && (
              <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATUS_CONFIG["blocked"].color + "20", color: STATUS_CONFIG["blocked"].color }}>
                {stats.blocked} blocked
              </span>
            )}
            <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "var(--accent)" + "20", color: "var(--accent)" }}>
              {stats.avgProgress}% avg
            </span>
          </div>
        )}

        {/* View toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
          {(["gantt", "calendar"] as PageView[]).map((v) => (
            <button
              key={v}
              onClick={() => setPageView(v)}
              style={{
                padding: "6px 14px",
                background: pageView === v ? "var(--accent)" : "var(--surface)",
                color: pageView === v ? "var(--accent-foreground)" : "var(--text-muted)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {v === "gantt" ? <><LayoutDashboard size={14} /> Gantt</> : <><CalendarDays size={14} /> Calendar</>}
            </button>
          ))}
        </div>

        <button
          onClick={() => addTask()}
          style={{
            padding: "8px 16px",
            background: "var(--accent)",
            color: "var(--accent-foreground)",
            border: "none",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          + Add Task
        </button>
      </div>

      {persistError && (
        <div
          role="alert"
          style={{
            padding: "8px 20px",
            borderBottom: "1px solid var(--border)",
            background: "color-mix(in srgb, var(--danger) 12%, var(--panel-bg))",
            color: "var(--danger)",
            fontSize: 12,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Save failed: {persistError}
        </div>
      )}

      {/* Main view: Gantt or Calendar */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {pageView === "gantt" ? <GanttChartView /> : <CalendarView />}
      </div>

      {/* Task edit modal */}
      {selectedTask && (
        <GanttTaskModal
          task={selectedTask}
          onSave={(updates) => updateTask(selectedTask.id, updates)}
          onDelete={() => { removeTask(selectedTask.id); selectTask(null); }}
          onClose={() => selectTask(null)}
        />
      )}
    </div>
  );
}
