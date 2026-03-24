import type { DiagramPerspective } from "@/lib/diagramPerspectives";
import type { LayoutPresetId } from "@/lib/layout";

export const LAYOUT_PRESET_STORAGE_KEY_PREFIX = "planview.layoutPreset.";
export const LAYOUT_PRESETS = new Set<LayoutPresetId>([
  "diagram-horizontal",
  "diagram-vertical",
  "mindmap",
  "org-tree",
]);

export function getClientErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function upsertPerspectiveInList(
  current: DiagramPerspective[],
  perspective: DiagramPerspective
): DiagramPerspective[] {
  const index = current.findIndex((entry) => entry.id === perspective.id);
  if (index === -1) return [...current, perspective];
  const next = [...current];
  next[index] = perspective;
  return next;
}
