import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { GanttChart, GanttTask } from "@/lib/ganttTypes";
import { createEmptyTask } from "@/lib/ganttTypes";
import { saveGanttChart, loadGanttChart } from "@/lib/ganttStorage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;

interface GanttStore {
  // State
  chart: GanttChart | null;
  selectedTaskId: string | null;
  dirty: boolean;

  // Actions
  loadChart: (id: string) => Promise<void>;
  initNewChart: (name: string, description: string) => Promise<string>;
  setChart: (chart: GanttChart) => void;
  updateMeta: (name: string, description: string) => void;

  // Task CRUD
  addTask: (task?: Partial<GanttTask>) => string;
  updateTask: (id: string, updates: Partial<GanttTask>) => void;
  removeTask: (id: string) => void;
  selectTask: (id: string | null) => void;
  reorderTask: (id: string, newIndex: number) => void;

  // Persistence
  persist: () => void;
}

function enqueuePersist(chart: GanttChart) {
  const seq = ++latestPersistRequest;
  persistQueue = persistQueue
    .then(async () => {
      if (seq !== latestPersistRequest) return;
      await saveGanttChart(chart);
    })
    .catch(() => { });
}

export const useGanttStore = create<GanttStore>((set, get) => ({
  chart: null,
  selectedTaskId: null,
  dirty: false,

  loadChart: async (id: string) => {
    const chart = await loadGanttChart(id);
    if (chart) {
      set({ chart, dirty: false, selectedTaskId: null });
    }
  },

  initNewChart: async (name: string, description: string) => {
    const now = new Date().toISOString();
    const chart: GanttChart = {
      id: uuidv4(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      tasks: [],
    };
    set({ chart, dirty: false, selectedTaskId: null });
    await saveGanttChart(chart);
    return chart.id;
  },

  setChart: (chart) => {
    set({ chart, dirty: true });
    enqueuePersist(chart);
  },

  updateMeta: (name, description) => {
    const { chart } = get();
    if (!chart) return;
    const updated = { ...chart, name, description, updatedAt: new Date().toISOString() };
    set({ chart: updated, dirty: true });
    enqueuePersist(updated);
  },

  addTask: (partial) => {
    const { chart } = get();
    if (!chart) return "";
    const id = uuidv4();
    const task: GanttTask = { ...createEmptyTask(id), ...partial, id };
    const updated = {
      ...chart,
      tasks: [...chart.tasks, task],
      updatedAt: new Date().toISOString(),
    };
    set({ chart: updated, dirty: true, selectedTaskId: id });
    enqueuePersist(updated);
    return id;
  },

  updateTask: (id, updates) => {
    const { chart } = get();
    if (!chart) return;
    const updated = {
      ...chart,
      tasks: chart.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      updatedAt: new Date().toISOString(),
    };
    set({ chart: updated, dirty: true });
    enqueuePersist(updated);
  },

  removeTask: (id) => {
    const { chart, selectedTaskId } = get();
    if (!chart) return;
    const updated = {
      ...chart,
      tasks: chart.tasks.filter((t) => t.id !== id),
      updatedAt: new Date().toISOString(),
    };
    set({
      chart: updated,
      dirty: true,
      selectedTaskId: selectedTaskId === id ? null : selectedTaskId,
    });
    enqueuePersist(updated);
  },

  selectTask: (id) => set({ selectedTaskId: id }),

  reorderTask: (id, newIndex) => {
    const { chart } = get();
    if (!chart) return;
    const tasks = [...chart.tasks];
    const oldIndex = tasks.findIndex((t) => t.id === id);
    if (oldIndex === -1) return;
    const [task] = tasks.splice(oldIndex, 1);
    tasks.splice(newIndex, 0, task);
    const updated = { ...chart, tasks, updatedAt: new Date().toISOString() };
    set({ chart: updated, dirty: true });
    enqueuePersist(updated);
  },

  persist: () => {
    const { chart } = get();
    if (chart) enqueuePersist(chart);
  },
}));
