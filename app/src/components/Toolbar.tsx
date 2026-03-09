"use client";

import { useCallback } from "react";
import { toSvg } from "html-to-image";
import { useReactFlow } from "@xyflow/react";
import {
  LayoutGrid,
  Undo2,
  Redo2,
  Trash2,
  Save,
  Camera,
  Sun,
  Moon,
  Group,
  Ungroup,
  BringToFront,
  SendToBack,
} from "lucide-react";
import { useDiagramStore } from "@/store/diagramStore";
import { useTheme } from "@/components/ThemeProvider";

export default function Toolbar() {
  const runAutoLayout = useDiagramStore((s) => s.runAutoLayout);
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

  const handleAutoLayout = useCallback(async (direction: "RIGHT" | "DOWN", closest: boolean) => {
    await runAutoLayout(direction, closest ? "CLOSEST" : "ORIENTED");
    requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 250 });
    });
  }, [runAutoLayout, fitView]);

  const handleExportPng = useCallback(async () => {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) return;
    try {
      const bg = getComputedStyle(document.documentElement)
        .getPropertyValue("--background")
        .trim();

      // Inline computed stroke styles on edge SVG paths so html-to-image
      // captures them (it cannot resolve CSS variables on SVG elements).
      const edgePaths = el.querySelectorAll<SVGElement>(
        ".react-flow__edge-path, .react-flow__edge-interaction"
      );
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

      // Also inline marker-end arrowhead fills
      const markers = el.querySelectorAll<SVGElement>("marker path");
      const savedMarkers: { el: SVGElement; fill: string }[] = [];
      markers.forEach((m) => {
        const computed = getComputedStyle(m);
        savedMarkers.push({ el: m, fill: m.style.fill });
        m.style.fill = computed.fill;
      });

      // Patch CSSStyleSheet.cssRules so html-to-image doesn't crash on
      // cross-origin / restricted stylesheets (e.g. VS Code codicon font).
      const origDescriptor = Object.getOwnPropertyDescriptor(
        CSSStyleSheet.prototype,
        "cssRules"
      );
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
        // Use toSvg → canvas → PNG to reliably capture SVG edges
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
        // Always restore the original descriptor
        if (origDescriptor) {
          Object.defineProperty(
            CSSStyleSheet.prototype,
            "cssRules",
            origDescriptor
          );
        }
      }

      // Restore original inline styles
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
        const ctx = canvas.getContext("2d")!;
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
    } catch (err) {
      console.error("Export failed:", err);
    }
  }, [diagramName]);

  const handleSave = useCallback(() => {
    persist();
  }, [persist]);

  const btnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    padding: "0",
    justifyContent: "center",
    background: "transparent",
    color: "var(--foreground)",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 500,
    transition: "all 0.15s ease",
  };

  const separatorStyle: React.CSSProperties = {
    width: 24,
    height: 1,
    background: "var(--border)",
    margin: "6px 0",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 6px",
        background: "var(--glass-bg)",
        backdropFilter: "blur(16px)",
        border: "1px solid var(--glass-border)",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.18), 0 2px 8px rgba(0, 0, 0, 0.12)",
        gap: 2,
      }}
    >
      <button
        onClick={(e) => void handleAutoLayout(e.shiftKey ? "DOWN" : "RIGHT", e.altKey)}
        style={btnStyle}
        title="Auto-arrange left-to-right (⌘L). Shift: top-to-bottom. Alt/Option: closest connectors."
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <LayoutGrid size={18} strokeWidth={2} />
      </button>

      <button
        onClick={undo}
        disabled={!canUndo}
        style={{
          ...btnStyle,
          opacity: canUndo ? 1 : 0.35,
          cursor: canUndo ? "pointer" : "not-allowed",
        }}
        title="Undo (⌘Z)"
        onMouseEnter={(e) => {
          if (!canUndo) return;
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Undo2 size={18} strokeWidth={2} />
      </button>

      <button
        onClick={redo}
        disabled={!canRedo}
        style={{
          ...btnStyle,
          opacity: canRedo ? 1 : 0.35,
          cursor: canRedo ? "pointer" : "not-allowed",
        }}
        title="Redo (⇧⌘Z)"
        onMouseEnter={(e) => {
          if (!canRedo) return;
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Redo2 size={18} strokeWidth={2} />
      </button>

      <div style={separatorStyle} />

      <button
        onClick={deleteSelected}
        style={btnStyle}
        title="Delete selected (Del)"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(248, 81, 73, 0.12)";
          e.currentTarget.style.color = "var(--danger)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Trash2 size={18} strokeWidth={2} />
      </button>

      <div style={separatorStyle} />

      <button
        onClick={groupSelectedNodes}
        style={btnStyle}
        title="Group selected (⌘G)"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Group size={18} strokeWidth={2} />
      </button>
      <button
        onClick={ungroupSelectedNodes}
        style={btnStyle}
        title="Ungroup (⌘⇧G)"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Ungroup size={18} strokeWidth={2} />
      </button>

      <div style={separatorStyle} />

      <button
        onClick={sendToFront}
        style={btnStyle}
        title="Bring to front (⌘])"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <BringToFront size={18} strokeWidth={2} />
      </button>
      <button
        onClick={sendToBack}
        style={btnStyle}
        title="Send to back (⌘[)"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <SendToBack size={18} strokeWidth={2} />
      </button>

      <div style={separatorStyle} />

      <button
        onClick={toggleTheme}
        style={btnStyle}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
      </button>

      <div style={separatorStyle} />

      <button onClick={handleSave}
        style={btnStyle} title="Save diagram (⌘S)"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--surface-hover)";
          e.currentTarget.style.color = "var(--success)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Save size={18} strokeWidth={2} />
      </button>
      <button
        onClick={handleExportPng}
        style={btnStyle}
        title="Export as PNG"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--accent-soft)";
          e.currentTarget.style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--foreground)";
        }}
      >
        <Camera size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
