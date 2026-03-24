"use client";

import { useCallback } from "react";
import { toSvg } from "html-to-image";
import { useReactFlow } from "@xyflow/react";
import {
  BringToFront,
  Camera,
  Group,
  LayoutGrid,
  Moon,
  Redo2,
  Save,
  SendToBack,
  Sun,
  Trash2,
  Undo2,
  Ungroup,
} from "lucide-react";
import { useDiagramStore } from "@/store/diagramStore";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";
import type { LayoutPresetId } from "@/lib/layout";

const LAYOUT_PRESET_OPTIONS: Array<{ value: LayoutPresetId; label: string }> = [
  { value: "diagram-horizontal", label: "Diagram H" },
  { value: "diagram-vertical", label: "Diagram V" },
  { value: "mindmap", label: "Mindmap" },
  { value: "org-tree", label: "Org Tree" },
];

function ToolbarButton({
  label,
  title,
  disabled,
  onClick,
  children,
}: {
  label: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] transition-all duration-150 md:h-9 md:w-9",
        "hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--text-muted)]"
      )}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[var(--panel-border)] bg-[var(--surface)] px-1 py-1 md:px-1.5 md:py-1.5">
      {children}
    </div>
  );
}

export default function Toolbar() {
  const runAutoLayout = useDiagramStore((s) => s.runAutoLayout);
  const layoutPreset = useDiagramStore((s) => s.layoutPreset);
  const setLayoutPreset = useDiagramStore((s) => s.setLayoutPreset);
  const canUndo = useDiagramStore((s) => s.canUndo);
  const canRedo = useDiagramStore((s) => s.canRedo);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const persist = useDiagramStore((s) => s.persist);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const groupSelectedNodes = useDiagramStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useDiagramStore((s) => s.ungroupSelectedNodes);
  const sendToFront = useDiagramStore((s) => s.sendToFront);
  const sendToBack = useDiagramStore((s) => s.sendToBack);
  const { theme, toggleTheme } = useTheme();
  const { fitView } = useReactFlow();

  const handleAutoLayout = useCallback(
    async (direction?: "RIGHT" | "DOWN") => {
      await runAutoLayout(direction, "CLOSEST");
      requestAnimationFrame(() => {
        void fitView({ padding: 0.18, duration: 250 });
      });
    },
    [fitView, runAutoLayout]
  );

  const handleExportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) return;

    try {
      const bg = getComputedStyle(document.documentElement).getPropertyValue("--canvas-bg").trim();
      const edgePaths = el.querySelectorAll<SVGElement>(".react-flow__edge-path, .react-flow__edge-interaction");
      const savedStyles: { el: SVGElement; stroke: string; strokeWidth: string }[] = [];

      edgePaths.forEach((path) => {
        const computed = getComputedStyle(path);
        savedStyles.push({
          el: path,
          stroke: path.style.stroke,
          strokeWidth: path.style.strokeWidth,
        });
        path.style.stroke = computed.stroke;
        path.style.strokeWidth = computed.strokeWidth;
      });

      const markers = el.querySelectorAll<SVGElement>("marker path");
      const savedMarkers: { el: SVGElement; fill: string }[] = [];
      markers.forEach((marker) => {
        const computed = getComputedStyle(marker);
        savedMarkers.push({ el: marker, fill: marker.style.fill });
        marker.style.fill = computed.fill;
      });

      const origDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
      Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
        get() {
          try {
            return origDescriptor?.get?.call(this);
          } catch {
            return [] as unknown as CSSRuleList;
          }
        },
        configurable: true,
      });

      let svgDataUrl: string;
      try {
        svgDataUrl = await toSvg(el, {
          backgroundColor: bg,
          filter: (node) => {
            const cls = (node as HTMLElement).className;
            if (typeof cls === "string") {
              if (cls.includes("react-flow__minimap")) return false;
              if (cls.includes("react-flow__controls")) return false;
              if (cls.includes("react-flow__panel")) return false;
            }
            return true;
          },
        });
      } finally {
        if (origDescriptor) {
          Object.defineProperty(CSSStyleSheet.prototype, "cssRules", origDescriptor);
        }
      }

      savedStyles.forEach(({ el: pathEl, stroke, strokeWidth }) => {
        pathEl.style.stroke = stroke;
        pathEl.style.strokeWidth = strokeWidth;
      });
      savedMarkers.forEach(({ el: markerEl, fill }) => {
        markerEl.style.fill = fill;
      });

      const img = new Image();
      img.onload = () => {
        const pixelRatio = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * pixelRatio;
        canvas.height = img.height * pixelRatio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.scale(pixelRatio, pixelRatio);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, img.width, img.height);
        ctx.drawImage(img, 0, 0);

        const pngUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `${diagramName.replace(/\s+/g, "_")}.png`;
        link.href = pngUrl;
        link.click();
      };
      img.src = svgDataUrl;
    } catch (error) {
      console.error("Export failed:", error);
    }
  }, [diagramName]);

  return (
    <div className="floating-panel flex w-max min-w-min max-w-full flex-nowrap items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 md:max-w-[calc(100vw-2rem)] md:flex-wrap md:gap-2 md:rounded-xl md:px-3 md:py-3">
      <ToolbarGroup>
        <ToolbarButton
          label="Auto arrange"
          title="Auto-arrange using the selected preset. Ctrl/Cmd+L reruns the current preset. Shift switches diagram presets between horizontal and vertical."
          onClick={() =>
            void handleAutoLayout(
              layoutPreset === "diagram-vertical"
                ? "DOWN"
                : layoutPreset === "diagram-horizontal"
                  ? "RIGHT"
                  : undefined
            )
          }
        >
          <LayoutGrid size={18} strokeWidth={2} />
        </ToolbarButton>
        <label className="sr-only" htmlFor="layout-preset">
          Layout preset
        </label>
        <select
          id="layout-preset"
          value={layoutPreset}
          onChange={(event) => setLayoutPreset(event.target.value as LayoutPresetId)}
          className={cn(
            "h-8 rounded-md border border-[var(--panel-border)] bg-[var(--surface)] px-2 text-[11px] font-semibold text-[var(--foreground)] outline-none transition-colors md:h-9",
            "hover:border-[var(--border-strong)] focus:border-[var(--accent)]"
          )}
          title="Choose the layout preset used by auto-arrange."
        >
          {LAYOUT_PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Delete selected" title="Delete selected (Delete)" onClick={deleteSelected}>
          <Trash2 size={18} strokeWidth={2} />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton label="Group selected" title="Group selected (Ctrl/Cmd+G)" onClick={groupSelectedNodes}>
          <Group size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Ungroup selected" title="Ungroup selected (Ctrl/Cmd+Shift+G)" onClick={ungroupSelectedNodes}>
          <Ungroup size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Bring to front" title="Bring to front (Ctrl/Cmd+])" onClick={sendToFront}>
          <BringToFront size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Send to back" title="Send to back (Ctrl/Cmd+[)" onClick={sendToBack}>
          <SendToBack size={18} strokeWidth={2} />
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton label="Export PNG" title="Export diagram as PNG" onClick={() => void handleExportPng()}>
          <Camera size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton label="Save" title="Save diagram (Ctrl/Cmd+S)" onClick={persist}>
          <Save size={18} strokeWidth={2} />
        </ToolbarButton>
        <ToolbarButton
          label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  );
}
