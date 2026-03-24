export type CanvasRenderMode = "full" | "compact" | "micro";

export function getCanvasRenderMode(zoom: number): CanvasRenderMode {
  if (zoom < 0.55) return "micro";
  if (zoom < 0.82) return "compact";
  return "full";
}
