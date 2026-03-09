import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { GanttChart, GanttTask } from "@/lib/ganttTypes";
import { createEmptyTask } from "@/lib/ganttTypes";
import { saveGanttChart, loadGanttChart } from "@/lib/ganttStorage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;
let latestLoadRequest = 0;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface GanttStore {
  // State
  chart: GanttChart | null;
  selectedTaskId: string | null;
  dirty: boolean;
  isLoading: boolean;
  loadError: string | null;
  persistError: string | null;

  // Actions
  loadChart: (id: string) => Promise<boolean>;
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

export const useGanttStore = create<GanttStore>((set, get) => {
  const enqueuePersist = (chart: GanttChart) => {
    const seq = ++latestPersistRequest;
    set({ persistError: null });
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (seq !== latestPersistRequest) return;
        await saveGanttChart(chart);
        set((state) => {
          if (!state.chart || state.chart.id !== chart.id) return {};
          return { dirty: false, persistError: null };
        });
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to save Gantt chart");
        console.error("Failed to persist Gantt chart", error);
        set({ persistError: message, dirty: true });
      });
  };

  return {
    chart: null,
    selectedTaskId: null,
    dirty: false,
    isLoading: false,
    loadError: null,
    persistError: null,

    loadChart: async (id: string) => {
      const requestId = ++latestLoadRequest;
      set({
        chart: null,
        selectedTaskId: null,
        dirty: false,
        isLoading: true,
        loadError: null,
      });

      try {
        const chart = await loadGanttChart(id);
        if (requestId !== latestLoadRequest) return false;
        if (!chart) {
          set({
            chart: null,
            selectedTaskId: null,
            dirty: false,
            isLoading: false,
            loadError: "Gantt chart not found",
          });
          return false;
        }

        set({
          chart,
          dirty: false,
          selectedTaskId: null,
          isLoading: false,
          loadError: null,
          persistError: null,
        });
        return true;
      } catch (error) {
        if (requestId !== latestLoadRequest) return false;
        const message = getErrorMessage(error, "Failed to load Gantt chart");
        console.error("Failed to load Gantt chart", error);
        set({
          chart: null,
          selectedTaskId: null,
          dirty: false,
          isLoading: false,
          loadError: message,
        });
        return false;
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
      try {
        await saveGanttChart(chart);
      } catch (error) {
        const message = getErrorMessage(error, "Failed to create Gantt chart");
        set({ persistError: message });
        throw error;
      }
      set({
        chart,
        dirty: false,
        selectedTaskId: null,
        isLoading: false,
        loadError: null,
        persistError: null,
      });
      return chart.id;
    },

    setChart: (chart) => {
      set({ chart, dirty: true, persistError: null });
      enqueuePersist(chart);
    },

    updateMeta: (name, description) => {
      const { chart } = get();
      if (!chart) return;
      const updated = { ...chart, name, description, updatedAt: new Date().toISOString() };
      set({ chart: updated, dirty: true, persistError: null });
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
      set({ chart: updated, dirty: true, selectedTaskId: id, persistError: null });
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
      set({ chart: updated, dirty: true, persistError: null });
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
        persistError: null,
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
      set({ chart: updated, dirty: true, persistError: null });
      enqueuePersist(updated);
    },

    persist: () => {
      const { chart } = get();
      if (chart) enqueuePersist(chart);
    },
  };
});
