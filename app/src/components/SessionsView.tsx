"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { KanbanProject, KanbanTask, ProjectSession } from "@/lib/projectTypes";
import { useProjectStore } from "@/store/projectStore";
import { Timer, Plus, Trash2, ChevronDown, ChevronRight, FileText, Play, Pause, RotateCcw, X, CheckSquare } from "lucide-react";

interface SessionsViewProps {
  project: KanbanProject;
  onSelectTask: (id: string | null) => void;
}

const POMODORO_DURATION = 25 * 60; // 25 minutes in seconds

export default function SessionsView({ project, onSelectTask }: SessionsViewProps) {
  const addSession = useProjectStore((s) => s.addSession);
  const updateSession = useProjectStore((s) => s.updateSession);
  const removeSession = useProjectStore((s) => s.removeSession);
  const addTaskToSession = useProjectStore((s) => s.addTaskToSession);
  const removeTaskFromSession = useProjectStore((s) => s.removeTaskFromSession);
  const incrementSessionPomodoro = useProjectStore((s) => s.incrementSessionPomodoro);

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(POMODORO_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setIsRunning(false);
          if (activeTimerId) {
            incrementSessionPomodoro(activeTimerId);
          }
          return POMODORO_DURATION;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, activeTimerId, incrementSessionPomodoro]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${min}:${sec}`;
  };

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    const id = addSession(newTitle.trim());
    setNewTitle("");
    setShowCreate(false);
    setExpandedId(id);
  };

  const handleStartTimer = (sessionId: string) => {
    if (activeTimerId !== sessionId) {
      setTimeLeft(POMODORO_DURATION);
    }
    setActiveTimerId(sessionId);
    setIsRunning(true);
  };

  const getTaskById = useCallback((taskId: string): KanbanTask | undefined => {
    return project.tasks.find((t) => t.id === taskId);
  }, [project.tasks]);

  const sessions = project.sessions ?? [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Timer size={18} style={{ color: "var(--accent)" }} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>Sessions</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 10 }}>{sessions.length}</span>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            padding: "7px 14px", background: "var(--accent)", color: "var(--accent-foreground)",
            border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <Plus size={14} /> New Session
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ marginBottom: 16, padding: 16, background: "var(--panel-bg)", border: "1px solid var(--border)", borderRadius: 10, flexShrink: 0 }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Session title…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowCreate(false);
            }}
            style={{
              width: "100%", padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 7, color: "var(--foreground)", fontSize: 13, outline: "none", marginBottom: 10, boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleCreate}
              style={{ padding: "6px 14px", background: "var(--accent)", color: "var(--accent-foreground)", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Create
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: "6px 12px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.length === 0 && !showCreate && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>
            <Timer size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No sessions yet</div>
            <div style={{ fontSize: 13 }}>Create a session to start tracking focused work with Pomodoro timers.</div>
          </div>
        )}

        {sessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const isTimerActive = activeTimerId === session.id;

          return (
            <div key={session.id} style={{ background: "var(--panel-bg)", border: `1px solid ${isExpanded ? "var(--accent)" : "var(--border)"}`, borderRadius: 10, transition: "border-color 0.15s" }}>
              {/* Session header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              >
                {isExpanded ? <ChevronDown size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronRight size={14} style={{ color: "var(--text-muted)" }} />}
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{session.title}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 8 }}>
                    🍅 {session.pomodorosCompleted}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 8px", borderRadius: 8 }}>
                    {session.taskIds.length} tasks
                  </span>
                  {isTimerActive && (
                    <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: isRunning ? "var(--accent)" : "var(--text-muted)" }}>
                      {formatTime(timeLeft)}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border)" }}>
                  {/* Timer controls */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 28, fontFamily: "monospace", fontWeight: 700, color: isTimerActive && isRunning ? "var(--accent)" : "var(--foreground)", letterSpacing: "0.05em" }}>
                      {isTimerActive ? formatTime(timeLeft) : formatTime(POMODORO_DURATION)}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(!isTimerActive || !isRunning) && (
                        <button onClick={() => handleStartTimer(session.id)} title="Start"
                          style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent)", color: "var(--accent-foreground)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Play size={14} />
                        </button>
                      )}
                      {isTimerActive && isRunning && (
                        <button onClick={() => setIsRunning(false)} title="Pause"
                          style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Pause size={14} />
                        </button>
                      )}
                      <button onClick={() => { setTimeLeft(POMODORO_DURATION); setIsRunning(false); }} title="Reset"
                        style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <RotateCcw size={14} />
                      </button>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>🍅 {session.pomodorosCompleted} completed</span>
                  </div>

                  {/* Notes */}
                  <div style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <FileText size={13} style={{ color: "var(--text-muted)" }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Notes</span>
                    </div>
                    <textarea
                      value={session.notes}
                      onChange={(e) => updateSession(session.id, { notes: e.target.value })}
                      placeholder="Session notes…"
                      rows={3}
                      style={{
                        width: "100%", padding: "8px 10px", background: "var(--surface)", border: "1px solid var(--border)",
                        borderRadius: 7, color: "var(--foreground)", fontSize: 13, outline: "none", resize: "vertical",
                        fontFamily: "inherit", lineHeight: 1.5, boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Linked tasks */}
                  <div style={{ padding: "12px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <CheckSquare size={13} style={{ color: "var(--text-muted)" }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Linked Tasks</span>
                      </div>
                      <button
                        onClick={() => setShowTaskPicker(showTaskPicker === session.id ? null : session.id)}
                        style={{ padding: "3px 10px", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Plus size={12} /> Add task
                      </button>
                    </div>

                    {/* Task picker dropdown */}
                    {showTaskPicker === session.id && (
                      <div style={{ marginBottom: 8, padding: 8, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
                        {project.tasks
                          .filter((t) => !session.taskIds.includes(t.id))
                          .map((task) => (
                            <div
                              key={task.id}
                              onClick={() => { addTaskToSession(session.id, task.id); setShowTaskPicker(null); }}
                              style={{ padding: "6px 8px", fontSize: 12, cursor: "pointer", borderRadius: 4, color: "var(--foreground)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-hover)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                            >
                              {task.name}
                            </div>
                          ))}
                        {project.tasks.filter((t) => !session.taskIds.includes(t.id)).length === 0 && (
                          <div style={{ padding: "6px 8px", fontSize: 12, color: "var(--text-muted)" }}>All tasks already linked</div>
                        )}
                      </div>
                    )}

                    {session.taskIds.length === 0 ? (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>No tasks linked to this session</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {session.taskIds.map((taskId) => {
                          const task = getTaskById(taskId);
                          if (!task) return null;
                          return (
                            <div key={taskId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "var(--surface)", borderRadius: 6 }}>
                              <span
                                onClick={() => onSelectTask(taskId)}
                                style={{ flex: 1, fontSize: 12, cursor: "pointer", color: "var(--foreground)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--foreground)"; }}
                              >
                                {task.name}
                              </span>
                              <button
                                onClick={() => removeTaskFromSession(session.id, taskId)}
                                style={{ width: 20, height: 20, background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4 }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Delete session */}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { removeSession(session.id); setExpandedId(null); }}
                      style={{ padding: "5px 12px", background: "transparent", color: "#ef4444", border: "1px solid #ef444440", borderRadius: 6, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Trash2 size={12} /> Delete Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
