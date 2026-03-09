import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { MatrixBoard, MatrixTask, MatrixQuadrant } from "@/lib/matrixTypes";
import { saveMatrixBoard, loadMatrixBoard } from "@/lib/matrixStorage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;
let latestLoadRequest = 0;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function createEmptyMatrixBoard(id: string): MatrixBoard {
  const now = new Date().toISOString();
  return {
    id,
    name: "New Matrix",
    createdAt: now,
    updatedAt: now,
    tasks: [],
  };
}

interface MatrixStore {
  board: MatrixBoard | null;
  dirty: boolean;
  isLoading: boolean;
  loadError: string | null;
  persistError: string | null;

  loadBoard: (id: string) => Promise<boolean>;
  initNewBoard: (name: string) => Promise<string>;
  setBoard: (board: MatrixBoard) => void;
  updateMeta: (name: string) => void;
  addTask: (title: string, quadrant: MatrixQuadrant) => void;
  updateTask: (taskId: string, title: string, quadrant: MatrixQuadrant) => void;
  removeTask: (taskId: string) => void;
  persist: () => void;
}

export const useMatrixStore = create<MatrixStore>((set, get) => {
  const enqueuePersist = (board: MatrixBoard) => {
    const seq = ++latestPersistRequest;
    set({ persistError: null });
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (seq !== latestPersistRequest) return;
        await saveMatrixBoard(board);
        set((state) => {
          if (!state.board || state.board.id !== board.id) return {};
          return { dirty: false, persistError: null };
        });
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to save Matrix board");
        console.error("Failed to persist Matrix board", error);
        set({ persistError: message, dirty: true });
      });
  };

  return {
    board: null,
    dirty: false,
    isLoading: false,
    loadError: null,
    persistError: null,

    loadBoard: async (id: string) => {
      const requestId = ++latestLoadRequest;
      set({ board: null, dirty: false, isLoading: true, loadError: null });

      try {
        const board = await loadMatrixBoard(id);
        if (requestId !== latestLoadRequest) return false;
        if (!board) {
          set({ isLoading: false, loadError: "Matrix board not found" });
          return false;
        }
        set({ board, dirty: false, isLoading: false });
        return true;
      } catch (error) {
        if (requestId !== latestLoadRequest) return false;
        set({ isLoading: false, loadError: getErrorMessage(error, "Load failed") });
        return false;
      }
    },

    initNewBoard: async (name: string) => {
      const id = uuidv4();
      const board = { ...createEmptyMatrixBoard(id), name };
      try {
        await saveMatrixBoard(board);
      } catch (error) {
        set({ persistError: getErrorMessage(error, "Failed to create matrix board") });
        throw error;
      }
      set({ board, dirty: false, isLoading: false, loadError: null, persistError: null });
      return id;
    },

    setBoard: (board) => {
      set({ board, dirty: true });
      enqueuePersist(board);
    },

    updateMeta: (name) => {
      const { board } = get();
      if (!board) return;
      const b = { ...board, name, updatedAt: new Date().toISOString() };
      set({ board: b, dirty: true });
      enqueuePersist(b);
    },

    addTask: (title, quadrant) => {
      const { board } = get();
      if (!board) return;
      const now = new Date().toISOString();
      const task: MatrixTask = { id: uuidv4(), title, quadrant, createdAt: now, updatedAt: now };
      const b = { ...board, tasks: [...board.tasks, task], updatedAt: now };
      set({ board: b, dirty: true });
      enqueuePersist(b);
    },

    updateTask: (taskId, title, quadrant) => {
      const { board } = get();
      if (!board) return;
      const b = {
        ...board,
        tasks: board.tasks.map(t => t.id === taskId ? { ...t, title, quadrant, updatedAt: new Date().toISOString() } : t),
        updatedAt: new Date().toISOString()
      };
      set({ board: b, dirty: true });
      enqueuePersist(b);
    },

    removeTask: (taskId) => {
      const { board } = get();
      if (!board) return;
      const b = {
        ...board,
        tasks: board.tasks.filter(t => t.id !== taskId),
        updatedAt: new Date().toISOString()
      };
      set({ board: b, dirty: true });
      enqueuePersist(b);
    },

    persist: () => {
      const { board, dirty } = get();
      if (board && dirty) {
        enqueuePersist(board);
      }
    }
  };
});
