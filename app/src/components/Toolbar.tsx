"use client";

import { useCallback } from "react";
import { toSvg } from "html-to-image";
import {
  LayoutGrid,
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
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const persist = useDiagramStore((s) => s.persist);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const groupSelectedNodes = useDiagramStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useDiagramStore((s) => s.ungroupSelectedNodes);
  const sendToFront = useDiagramStore((s) => s.sendToFront);
  const sendToBack = useDiagramStore((s) => s.sendToBack);
  const { theme, toggleTheme } = useTheme();

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
    fontSize: "11px",
    padding: "5px 10px",
    background: "var(--surface)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    transition: "background 0.15s",
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        background: "var(--panel-bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <button
        onClick={runAutoLayout}
        style={btnStyle}
        title="Auto-arrange nodes"
      >
        <LayoutGrid size={14} /> Auto Layout
      </button>
      <button
        onClick={deleteSelected}
        style={btnStyle}
        title="Delete selected nodes/edges"
      >
        <Trash2 size={14} /> Delete
      </button>
      <button
        onClick={groupSelectedNodes}
        style={btnStyle}
        title="Group selected nodes"
      >
        <Group size={14} /> Group
      </button>
      <button
        onClick={ungroupSelectedNodes}
        style={btnStyle}
        title="Ungroup selected group"
      >
        <Ungroup size={14} /> Ungroup
      </button>

      {/* Separator */}
      <div style={{ width: 1, height: 20, background: "var(--border)" }} />

      <button
        onClick={sendToFront}
        style={btnStyle}
        title="Send to front (⌘])"
      >
        <BringToFront size={14} /> Front
      </button>
      <button
        onClick={sendToBack}
        style={btnStyle}
        title="Send to back (⌘[)"
      >
        <SendToBack size={14} /> Back
      </button>
      <div style={{ flex: 1 }} />
      <button
        onClick={toggleTheme}
        style={btnStyle}
        title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        {theme === "dark" ? "Light" : "Dark"}
      </button>
      <button onClick={handleSave} style={btnStyle} title="Save diagram">
        <Save size={14} /> Save
      </button>
      <button
        onClick={handleExportPng}
        style={{
          ...btnStyle,
          background: "var(--accent)",
          borderColor: "var(--accent)",
          color: "#fff",
        }}
        title="Export as PNG"
      >
        <Camera size={14} /> Export PNG
      </button>
    </div>
  );
}
