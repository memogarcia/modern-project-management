import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  KanbanProject,
  KanbanEpic,
  KanbanTask,
  KanbanColumn,
  KanbanTaskPriority,
  KanbanTaskLink,
  KanbanViewMode,
  ProjectSession,
} from "@/lib/projectTypes";
import { DEFAULT_KANBAN_COLUMNS } from "@/lib/projectTypes";
import { saveProject, loadProject } from "@/lib/projectStorage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;
let latestLoadRequest = 0;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface ProjectStore {
  // State
  project: KanbanProject | null;
  selectedTaskId: string | null;
  activeView: KanbanViewMode;
  dirty: boolean;
  isLoading: boolean;
  loadError: string | null;
  persistError: string | null;

  // Project actions
  loadProject: (id: string) => Promise<boolean>;
  initNewProject: (name: string, description?: string) => Promise<string>;
  updateMeta: (name: string, description?: string) => void;

  // Column CRUD
  addColumn: (name: string, color: string, position?: number, wipLimit?: number) => string;
  updateColumn: (columnId: string, updates: Partial<Pick<KanbanColumn, "name" | "color" | "wipLimit">>) => void;
  reorderColumns: (columnIds: string[]) => void;
  deleteColumn: (columnId: string, targetColumnId: string) => void;

  // Epic CRUD
  addEpic: (name: string, description?: string, color?: string) => string;
  updateEpic: (epicId: string, updates: Partial<Pick<KanbanEpic, "name" | "description" | "color">>) => void;
  deleteEpic: (epicId: string, targetEpicId?: string) => void;

  // Task CRUD
  addTask: (task: {
    epicId: string;
    columnId: string;
    name: string;
    description?: string;
    priority?: KanbanTaskPriority;
    assignee?: string;
    tags?: string[];
    startDate?: string;
    dueDate?: string;
    progress?: number;
  }) => string;
  updateTask: (taskId: string, updates: Partial<Omit<KanbanTask, "id" | "createdAt" | "updatedAt">>) => void;
  moveTask: (taskId: string, columnId?: string, position?: number) => void;
  removeTask: (taskId: string) => void;
  addLinkToTask: (taskId: string, link: KanbanTaskLink) => void;

  // Session CRUD
  addSession: (title: string) => string;
  updateSession: (sessionId: string, updates: Partial<Pick<ProjectSession, "title" | "notes">>) => void;
  removeSession: (sessionId: string) => void;
  addTaskToSession: (sessionId: string, taskId: string) => void;
  removeTaskFromSession: (sessionId: string, taskId: string) => void;
  incrementSessionPomodoro: (sessionId: string) => void;

  // Diagram linking
  linkDiagram: (diagramId: string) => void;
  unlinkDiagram: (diagramId: string) => void;

  // View
  setActiveView: (view: KanbanViewMode) => void;
  selectTask: (id: string | null) => void;

  // Persistence
  persist: () => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => {
  const enqueuePersist = (project: KanbanProject) => {
    const seq = ++latestPersistRequest;
    set({ persistError: null });
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (seq !== latestPersistRequest) return;
        await saveProject(project);
        set((state) => {
          if (!state.project || state.project.id !== project.id) return {};
          return { dirty: false, persistError: null };
        });
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to save project");
        console.error("Failed to persist project", error);
        set({ persistError: message, dirty: true });
      });
  };

  const mutate = (fn: (project: KanbanProject) => void) => {
    const { project } = get();
    if (!project) return;
    const updated = { ...project, updatedAt: new Date().toISOString() };
    fn(updated);
    set({ project: updated, dirty: true, persistError: null });
    enqueuePersist(updated);
  };

  return {
    project: null,
    selectedTaskId: null,
    activeView: "overview",
    dirty: false,
    isLoading: false,
    loadError: null,
    persistError: null,

    loadProject: async (id: string) => {
      const requestId = ++latestLoadRequest;
      set({
        project: null,
        selectedTaskId: null,
        dirty: false,
        isLoading: true,
        loadError: null,
      });

      try {
        const project = await loadProject(id);
        if (requestId !== latestLoadRequest) return false;
        if (!project) {
          set({ project: null, isLoading: false, loadError: "Project not found" });
          return false;
        }
        // Ensure new fields exist (backward compat for existing JSON)
        if (!project.sessions) project.sessions = [];
        if (!project.diagramIds) project.diagramIds = [];
        set({
          project,
          dirty: false,
          selectedTaskId: null,
          isLoading: false,
          loadError: null,
          persistError: null,
        });
        return true;
      } catch (error) {
        if (requestId !== latestLoadRequest) return false;
        const message = getErrorMessage(error, "Failed to load project");
        set({ project: null, isLoading: false, loadError: message });
        return false;
      }
    },

    initNewProject: async (name: string, description?: string) => {
      const now = new Date().toISOString();
      const project: KanbanProject = {
        id: uuidv4(),
        name,
        description: description ?? "",
        createdAt: now,
        updatedAt: now,
        columns: [...DEFAULT_KANBAN_COLUMNS],
        epics: [],
        tasks: [],
        sessions: [],
        diagramIds: [],
      };
      try {
        await saveProject(project);
      } catch (error) {
        const message = getErrorMessage(error, "Failed to create project");
        set({ persistError: message });
        throw error;
      }
      set({
        project,
        dirty: false,
        selectedTaskId: null,
        isLoading: false,
        loadError: null,
        persistError: null,
      });
      return project.id;
    },

    updateMeta: (name: string, description?: string) => {
      mutate((p) => {
        p.name = name;
        if (description !== undefined) p.description = description;
      });
    },

    // Column CRUD
    addColumn: (name, color, position, wipLimit) => {
      const id = uuidv4();
      mutate((p) => {
        const col: KanbanColumn = {
          id,
          name,
          color,
          position: position ?? p.columns.length,
          wipLimit,
        };
        p.columns = [...p.columns, col];
        p.columns.sort((a, b) => a.position - b.position);
        p.columns.forEach((c, i) => { c.position = i; });
      });
      return id;
    },

    updateColumn: (columnId, updates) => {
      mutate((p) => {
        p.columns = p.columns.map((c) =>
          c.id === columnId ? { ...c, ...updates } : c
        );
      });
    },

    reorderColumns: (columnIds) => {
      mutate((p) => {
        const map = new Map(p.columns.map((c) => [c.id, c]));
        p.columns = columnIds
          .map((id, i) => {
            const col = map.get(id);
            if (col) col.position = i;
            return col;
          })
          .filter(Boolean) as KanbanColumn[];
      });
    },

    deleteColumn: (columnId, targetColumnId) => {
      mutate((p) => {
        p.tasks = p.tasks.map((t) =>
          t.columnId === columnId ? { ...t, columnId: targetColumnId } : t
        );
        p.columns = p.columns.filter((c) => c.id !== columnId);
        p.columns.sort((a, b) => a.position - b.position);
        p.columns.forEach((c, i) => { c.position = i; });
      });
    },

    // Epic CRUD
    addEpic: (name, description, color) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      mutate((p) => {
        p.epics = [...p.epics, { id, name, description, color, createdAt: now, updatedAt: now }];
      });
      return id;
    },

    updateEpic: (epicId, updates) => {
      mutate((p) => {
        p.epics = p.epics.map((e) =>
          e.id === epicId ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        );
      });
    },

    deleteEpic: (epicId, targetEpicId) => {
      mutate((p) => {
        if (targetEpicId) {
          p.tasks = p.tasks.map((t) =>
            t.epicId === epicId ? { ...t, epicId: targetEpicId } : t
          );
        } else {
          p.tasks = p.tasks.filter((t) => t.epicId !== epicId);
        }
        p.epics = p.epics.filter((e) => e.id !== epicId);
      });
    },

    // Task CRUD
    addTask: (taskInput) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      mutate((p) => {
        const tasksInColumn = p.tasks.filter((t) => t.columnId === taskInput.columnId);
        const task: KanbanTask = {
          id,
          epicId: taskInput.epicId,
          columnId: taskInput.columnId,
          name: taskInput.name,
          description: taskInput.description,
          priority: taskInput.priority ?? "medium",
          assignee: taskInput.assignee,
          tags: taskInput.tags ?? [],
          startDate: taskInput.startDate,
          dueDate: taskInput.dueDate,
          progress: taskInput.progress ?? 0,
          position: tasksInColumn.length,
          links: [],
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        p.tasks = [...p.tasks, task];
      });
      set({ selectedTaskId: id });
      return id;
    },

    updateTask: (taskId, updates) => {
      mutate((p) => {
        p.tasks = p.tasks.map((t) =>
          t.id === taskId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
        );
      });
    },

    moveTask: (taskId, columnId, position) => {
      mutate((p) => {
        const task = p.tasks.find((t) => t.id === taskId);
        if (!task) return;
        const targetCol = columnId ?? task.columnId;
        task.columnId = targetCol;
        // Re-position
        const colTasks = p.tasks
          .filter((t) => t.columnId === targetCol && t.id !== taskId)
          .sort((a, b) => a.position - b.position);
        const insertAt = position !== undefined ? Math.min(position, colTasks.length) : colTasks.length;
        colTasks.splice(insertAt, 0, task);
        colTasks.forEach((t, i) => { t.position = i; });
        task.updatedAt = new Date().toISOString();
      });
    },

    removeTask: (taskId) => {
      mutate((p) => {
        p.tasks = p.tasks.filter((t) => t.id !== taskId);
        // Also remove task references from sessions
        p.sessions = p.sessions.map((s) => ({
          ...s,
          taskIds: s.taskIds.filter((tid) => tid !== taskId),
        }));
      });
      set((state) => ({
        selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
      }));
    },

    addLinkToTask: (taskId, link) => {
      mutate((p) => {
        p.tasks = p.tasks.map((t) =>
          t.id === taskId
            ? { ...t, links: [...t.links, link], updatedAt: new Date().toISOString() }
            : t
        );
      });
    },

    // Session CRUD
    addSession: (title: string) => {
      const id = uuidv4();
      const now = new Date().toISOString();
      mutate((p) => {
        const session: ProjectSession = {
          id,
          title,
          notes: "",
          taskIds: [],
          pomodorosCompleted: 0,
          createdAt: now,
          updatedAt: now,
        };
        p.sessions = [...p.sessions, session];
      });
      return id;
    },

    updateSession: (sessionId, updates) => {
      mutate((p) => {
        p.sessions = p.sessions.map((s) =>
          s.id === sessionId ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
        );
      });
    },

    removeSession: (sessionId) => {
      mutate((p) => {
        p.sessions = p.sessions.filter((s) => s.id !== sessionId);
      });
    },

    addTaskToSession: (sessionId, taskId) => {
      mutate((p) => {
        p.sessions = p.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          if (s.taskIds.includes(taskId)) return s;
          return { ...s, taskIds: [...s.taskIds, taskId], updatedAt: new Date().toISOString() };
        });
      });
    },

    removeTaskFromSession: (sessionId, taskId) => {
      mutate((p) => {
        p.sessions = p.sessions.map((s) => {
          if (s.id !== sessionId) return s;
          return { ...s, taskIds: s.taskIds.filter((tid) => tid !== taskId), updatedAt: new Date().toISOString() };
        });
      });
    },

    incrementSessionPomodoro: (sessionId) => {
      mutate((p) => {
        p.sessions = p.sessions.map((s) =>
          s.id === sessionId
            ? { ...s, pomodorosCompleted: s.pomodorosCompleted + 1, updatedAt: new Date().toISOString() }
            : s
        );
      });
    },

    // Diagram linking
    linkDiagram: (diagramId) => {
      mutate((p) => {
        if (!p.diagramIds.includes(diagramId)) {
          p.diagramIds = [...p.diagramIds, diagramId];
        }
      });
    },

    unlinkDiagram: (diagramId) => {
      mutate((p) => {
        p.diagramIds = p.diagramIds.filter((id) => id !== diagramId);
      });
    },

    // View
    setActiveView: (view) => set({ activeView: view }),
    selectTask: (id) => set({ selectedTaskId: id }),

    // Persistence
    persist: () => {
      const { project } = get();
      if (project) enqueuePersist(project);
    },
  };
});
