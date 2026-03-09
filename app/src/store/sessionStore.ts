import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type { Session, SessionLink } from "@/lib/sessionTypes";
import { saveSession, loadSession } from "@/lib/sessionStorage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;
let latestLoadRequest = 0;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function createEmptySession(id: string): Session {
  const now = new Date().toISOString();
  return {
    id,
    title: "New Session",
    createdAt: now,
    updatedAt: now,
    notes: "",
    tasks: [],
    links: [],
    pomodorosCompleted: 0,
  };
}

interface SessionStore {
  session: Session | null;
  dirty: boolean;
  isLoading: boolean;
  loadError: string | null;
  persistError: string | null;

  loadSession: (id: string) => Promise<boolean>;
  initNewSession: (title: string) => Promise<string>;
  setSession: (session: Session) => void;
  updateMeta: (title: string, notes: string) => void;
  addTask: (task: string) => void;
  removeTask: (index: number) => void;
  addLink: (link: SessionLink) => void;
  removeLink: (index: number) => void;
  incrementPomodoro: () => void;
  persist: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => {
  const enqueuePersist = (session: Session) => {
    const seq = ++latestPersistRequest;
    set({ persistError: null });
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (seq !== latestPersistRequest) return;
        await saveSession(session);
        set((state) => {
          if (!state.session || state.session.id !== session.id) return {};
          return { dirty: false, persistError: null };
        });
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to save Session");
        console.error("Failed to persist Session", error);
        set({ persistError: message, dirty: true });
      });
  };

  return {
    session: null,
    dirty: false,
    isLoading: false,
    loadError: null,
    persistError: null,

    loadSession: async (id: string) => {
      const requestId = ++latestLoadRequest;
      set({ session: null, dirty: false, isLoading: true, loadError: null });

      try {
        const session = await loadSession(id);
        if (requestId !== latestLoadRequest) return false;
        if (!session) {
          set({ isLoading: false, loadError: "Session not found" });
          return false;
        }
        set({ session, dirty: false, isLoading: false });
        return true;
      } catch (error) {
        if (requestId !== latestLoadRequest) return false;
        set({ isLoading: false, loadError: getErrorMessage(error, "Load failed") });
        return false;
      }
    },

    initNewSession: async (title: string) => {
      const id = uuidv4();
      const session = { ...createEmptySession(id), title };
      try {
        await saveSession(session);
      } catch (error) {
        set({ persistError: getErrorMessage(error, "Failed to create session") });
        throw error;
      }
      set({ session, dirty: false, isLoading: false, loadError: null, persistError: null });
      return id;
    },

    setSession: (session) => {
      set({ session, dirty: true });
      enqueuePersist(session);
    },

    updateMeta: (title, notes) => {
      const { session } = get();
      if (!session) return;
      const s = { ...session, title, notes, updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    addTask: (task) => {
      const { session } = get();
      if (!session) return;
      const s = { ...session, tasks: [...session.tasks, task], updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    removeTask: (index) => {
      const { session } = get();
      if (!session) return;
      const newTasks = [...session.tasks];
      newTasks.splice(index, 1);
      const s = { ...session, tasks: newTasks, updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    addLink: (link) => {
      const { session } = get();
      if (!session) return;
      const s = { ...session, links: [...session.links, link], updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    removeLink: (index) => {
      const { session } = get();
      if (!session) return;
      const newLinks = [...session.links];
      newLinks.splice(index, 1);
      const s = { ...session, links: newLinks, updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    incrementPomodoro: () => {
      const { session } = get();
      if (!session) return;
      const s = { ...session, pomodorosCompleted: session.pomodorosCompleted + 1, updatedAt: new Date().toISOString() };
      set({ session: s, dirty: true });
      enqueuePersist(s);
    },

    persist: () => {
      const { session, dirty } = get();
      if (session && dirty) {
        enqueuePersist(session);
      }
    }
  };
});
