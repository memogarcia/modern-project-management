"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { KanbanProject, KanbanTask, ProjectSession } from "@/lib/projectTypes";
import { useProjectStore } from "@/store/projectStore";
import { Timer, Plus, Trash2, ChevronDown, ChevronRight, FileText, Play, Pause, RotateCcw, X, CheckSquare } from "lucide-react";
import { Button } from "./ui/button";
import { IconButton } from "./ui/icon-button";
import { EmptyState } from "./ui/empty-state";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="h-[18px] w-[18px] text-[var(--accent)]" />
          <span className="text-base font-bold">Sessions</span>
          <span className="text-xs text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-full">
            {sessions.length}
          </span>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Session
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="mb-4 p-4 bg-[var(--panel-bg)] border border-[var(--border)] rounded-xl shrink-0">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Session title…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setShowCreate(false);
            }}
            className="w-full px-3 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-[13px] outline-none mb-2.5 focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Create</Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {sessions.length === 0 && !showCreate && (
          <EmptyState
            icon={<Timer />}
            title="No sessions yet"
            description="Create a session to start tracking focused work with Pomodoro timers."
          />
        )}

        {sessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const isTimerActive = activeTimerId === session.id;

          return (
            <div
              key={session.id}
              className={cn(
                "bg-[var(--panel-bg)] border rounded-xl transition-[border-color] duration-150",
                isExpanded ? "border-[var(--accent)]" : "border-[var(--border)]"
              )}
            >
              {/* Session header */}
              <div
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
                className="flex items-center gap-2.5 px-4 py-3 cursor-pointer"
              >
                {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />}
                <span className="flex-1 text-sm font-semibold">{session.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-lg">
                    🍅 {session.pomodorosCompleted}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)] bg-[var(--surface)] px-2 py-0.5 rounded-lg">
                    {session.taskIds.length} tasks
                  </span>
                  {isTimerActive && (
                    <span className={cn(
                      "text-xs font-bold tabular-nums tracking-wider",
                      isRunning ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                    )}>
                      {formatTime(timeLeft)}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[var(--border)]">
                  {/* Timer controls */}
                  <div className="flex items-center gap-3 py-3 border-b border-[var(--border)]">
                    <span className={cn(
                      "text-3xl font-bold tabular-nums tracking-wider",
                      isTimerActive && isRunning ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                    )}>
                      {isTimerActive ? formatTime(timeLeft) : formatTime(POMODORO_DURATION)}
                    </span>
                    <div className="flex gap-1.5">
                      {(!isTimerActive || !isRunning) && (
                        <Button size="icon" className="h-9 w-9" onClick={() => handleStartTimer(session.id)} title="Start">
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {isTimerActive && isRunning && (
                        <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setIsRunning(false)} title="Pause">
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 text-[var(--text-muted)]"
                        onClick={() => { setTimeLeft(POMODORO_DURATION); setIsRunning(false); }}
                        title="Reset"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] ml-auto">🍅 {session.pomodorosCompleted} completed</span>
                  </div>

                  {/* Notes */}
                  <div className="py-3 border-b border-[var(--border)]">
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                      <span className="text-xs font-semibold text-[var(--text-muted)]">Notes</span>
                    </div>
                    <textarea
                      value={session.notes}
                      onChange={(e) => updateSession(session.id, { notes: e.target.value })}
                      placeholder="Session notes…"
                      rows={3}
                      className="w-full px-2.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] text-[13px] outline-none resize-y font-[inherit] leading-relaxed focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                    />
                  </div>

                  {/* Linked tasks */}
                  <div className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <CheckSquare className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        <span className="text-xs font-semibold text-[var(--text-muted)]">Linked Tasks</span>
                      </div>
                      <button
                        onClick={() => setShowTaskPicker(showTaskPicker === session.id ? null : session.id)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)] rounded-md text-[11px] cursor-pointer hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Add task
                      </button>
                    </div>

                    {/* Task picker dropdown */}
                    {showTaskPicker === session.id && (
                      <div className="mb-2 p-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg max-h-40 overflow-y-auto">
                        {project.tasks
                          .filter((t) => !session.taskIds.includes(t.id))
                          .map((task) => (
                            <div
                              key={task.id}
                              onClick={() => { addTaskToSession(session.id, task.id); setShowTaskPicker(null); }}
                              className="px-2 py-1.5 text-xs cursor-pointer rounded text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
                            >
                              {task.name}
                            </div>
                          ))}
                        {project.tasks.filter((t) => !session.taskIds.includes(t.id)).length === 0 && (
                          <div className="px-2 py-1.5 text-xs text-[var(--text-muted)]">All tasks already linked</div>
                        )}
                      </div>
                    )}

                    {session.taskIds.length === 0 ? (
                      <div className="text-xs text-[var(--text-muted)] py-1">No tasks linked to this session</div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {session.taskIds.map((taskId) => {
                          const task = getTaskById(taskId);
                          if (!task) return null;
                          return (
                            <div key={taskId} className="flex items-center gap-2 px-2 py-1.5 bg-[var(--surface)] rounded-md">
                              <span
                                onClick={() => onSelectTask(taskId)}
                                className="flex-1 text-xs cursor-pointer text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
                              >
                                {task.name}
                              </span>
                              <IconButton
                                size="sm"
                                hoverVariant="danger"
                                onClick={() => removeTaskFromSession(session.id, taskId)}
                              >
                                <X className="h-3 w-3" />
                              </IconButton>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Delete session */}
                  <div className="border-t border-[var(--border)] pt-3 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[var(--danger)] border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 hover:border-[var(--danger)]"
                      onClick={() => { if (!confirm("Delete this session and all its data?")) return; removeSession(session.id); setExpandedId(null); }}
                    >
                      <Trash2 className="h-3 w-3" /> Delete Session
                    </Button>
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
