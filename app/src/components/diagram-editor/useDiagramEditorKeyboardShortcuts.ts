"use client";

import { useEffect, type MutableRefObject } from "react";
import type { LayoutDirection, LayoutPresetId } from "@/lib/layout";
import type { ArchEdge, DiagramNode } from "@/lib/types";

type EdgeAttachMode = "ORIENTED" | "CLOSEST";

interface ClipboardPayload {
  version: 1;
  nodes: DiagramNode[];
  edges: ArchEdge[];
}

interface UseDiagramEditorKeyboardShortcutsOptions {
  lastPointerFlowPosRef: MutableRefObject<{ x: number; y: number } | null>;
  layoutPreset: LayoutPresetId;
  persist: () => void;
  undo: () => void;
  redo: () => void;
  runAutoLayout: (direction?: LayoutDirection, mode?: EdgeAttachMode) => Promise<void>;
  fitView: (options: { padding: number; duration: number }) => unknown;
  screenToFlowPosition: (position: { x: number; y: number }) => { x: number; y: number };
  copySelected: () => ClipboardPayload | null;
  cutSelected: () => ClipboardPayload | null;
  pasteClipboard: (position: { x: number; y: number }, payload?: ClipboardPayload) => void;
  groupSelectedNodes: () => void;
  ungroupSelectedNodes: () => void;
  sendToFront: () => void;
  sendToBack: () => void;
  sendForward: () => void;
  sendBackward: () => void;
  deleteSelected: () => void;
}

function isTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest(".monaco-editor")) return true;
  return false;
}

function isValidClipboardPayload(value: unknown): value is ClipboardPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as { version?: unknown; nodes?: unknown; edges?: unknown };
  return payload.version === 1 && Array.isArray(payload.nodes) && Array.isArray(payload.edges);
}

export function useDiagramEditorKeyboardShortcuts({
  lastPointerFlowPosRef,
  layoutPreset,
  persist,
  undo,
  redo,
  runAutoLayout,
  fitView,
  screenToFlowPosition,
  copySelected,
  cutSelected,
  pasteClipboard,
  groupSelectedNodes,
  ungroupSelectedNodes,
  sendToFront,
  sendToBack,
  sendForward,
  sendBackward,
  deleteSelected,
}: UseDiagramEditorKeyboardShortcutsOptions): void {
  useEffect(() => {
    const refitCanvas = () => {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.18, duration: 250 });
      });
    };

    const handler = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        persist();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (event.ctrlKey && !event.metaKey && (event.key === "y" || event.key === "Y")) {
        event.preventDefault();
        redo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "l") {
        event.preventDefault();
        const direction =
          layoutPreset === "diagram-horizontal" || layoutPreset === "diagram-vertical"
            ? event.shiftKey
              ? "DOWN"
              : "RIGHT"
            : undefined;
        void runAutoLayout(direction, "CLOSEST").then(() => {
          refitCanvas();
        });
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "c") {
        event.preventDefault();
        const payload = copySelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore clipboard failures.
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "x") {
        event.preventDefault();
        const payload = cutSelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore clipboard failures.
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "v") {
        event.preventDefault();
        const fallbackPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const pos = lastPointerFlowPosRef.current ?? fallbackPos;

        const pasteFromSystemClipboard = async () => {
          try {
            const text = await navigator.clipboard?.readText?.();
            if (!text) {
              pasteClipboard(pos);
              return;
            }
            const parsed = JSON.parse(text) as unknown;
            if (isValidClipboardPayload(parsed)) {
              pasteClipboard(pos, parsed);
              return;
            }
          } catch {
            // ignore clipboard failures.
          }
          pasteClipboard(pos);
        };

        void pasteFromSystemClipboard();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "g" && !event.shiftKey) {
        event.preventDefault();
        groupSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "G") {
        event.preventDefault();
        ungroupSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "]") {
        event.preventDefault();
        if (event.shiftKey) sendForward();
        else sendToFront();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "[") {
        event.preventDefault();
        if (event.shiftKey) sendBackward();
        else sendToBack();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    copySelected,
    cutSelected,
    deleteSelected,
    fitView,
    groupSelectedNodes,
    layoutPreset,
    lastPointerFlowPosRef,
    pasteClipboard,
    persist,
    redo,
    runAutoLayout,
    screenToFlowPosition,
    sendBackward,
    sendForward,
    sendToBack,
    sendToFront,
    undo,
    ungroupSelectedNodes,
  ]);
}
