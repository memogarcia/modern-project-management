"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ArchEdge } from "@/lib/types";

interface EdgeEditModalProps {
  edge: ArchEdge;
  onSave: (edgeId: string, updates: Partial<ArchEdge>) => void;
  onClose: () => void;
}

const EDGE_TYPES: { value: string; label: string }[] = [
  { value: "smoothstep", label: "Smooth Step" },
  { value: "default", label: "Bezier" },
  { value: "straight", label: "Straight" },
  { value: "step", label: "Step" },
];

const STROKE_COLORS = [
  "#475569", "#333333", "#000000", "#94a3b8", "#cbd5e1",
  "#2196f3", "#4caf50", "#9c27b0", "#ff9800", "#00bcd4",
  "#f44336", "#cddc39", "#3f51b5", "#03a9f4", "#e91e63",
];

const STROKE_WIDTHS = [1, 2, 3, 4, 5];

export default function EdgeEditModal({ edge, onSave, onClose }: EdgeEditModalProps) {
  const [label, setLabel] = useState((edge.data?.label ?? edge.label ?? "") as string);
  const [edgeType, setEdgeType] = useState(edge.type ?? "smoothstep");
  const [animated, setAnimated] = useState(edge.animated ?? false);
  const [strokeColor, setStrokeColor] = useState(edge.data?.strokeColor ?? edge.style?.stroke ?? "#475569");
  const [strokeWidth, setStrokeWidth] = useState(edge.data?.strokeWidth ?? edge.style?.strokeWidth ?? 2);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = useCallback(() => {
    onSave(edge.id, {
      label: label.trim() || undefined,
      type: edgeType,
      animated,
      style: {
        stroke: strokeColor,
        strokeWidth: Number(strokeWidth),
      },
      data: {
        ...edge.data,
        label: label.trim() || undefined,
        strokeColor,
        strokeWidth: Number(strokeWidth),
      },
    });
    onClose();
  }, [edge.id, edge.data, label, edgeType, animated, strokeColor, strokeWidth, onSave, onClose]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  return (
    <div ref={overlayRef} className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div className="edit-modal" style={{ maxWidth: 440 }}>
        {/* Header */}
        <div className="edit-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
            <span>Edit Edge</span>
          </div>
          <button className="edit-modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="edit-modal-body">
          {/* Label */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Label</label>
            <input
              className="edit-modal-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Edge label (optional)"
              autoFocus
            />
          </div>

          {/* Edge Type */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Edge Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              {EDGE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setEdgeType(t.value)}
                  className="edit-modal-btn"
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    fontSize: 12,
                    background: edgeType === t.value ? "var(--accent)" : "var(--surface)",
                    color: edgeType === t.value ? "var(--accent-foreground)" : "var(--foreground)",
                    border: `1px solid ${edgeType === t.value ? "var(--accent)" : "var(--border)"}`,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stroke Color */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Stroke Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
                style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "none", padding: 0 }}
              />
              {STROKE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setStrokeColor(c)}
                  className="edit-modal-color-swatch"
                  style={{
                    background: c,
                    outline: strokeColor === c ? "2px solid var(--accent)" : "1px solid var(--border)",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Stroke Width */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Stroke Width</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className="edit-modal-btn"
                  style={{
                    width: 40,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    background: strokeWidth === w ? "var(--accent)" : "var(--surface)",
                    color: strokeWidth === w ? "var(--accent-foreground)" : "var(--foreground)",
                    border: `1px solid ${strokeWidth === w ? "var(--accent)" : "var(--border)"}`,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {w}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>px</span>
            </div>
          </div>

          {/* Animation Toggle */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Animation</label>
            <label className="edit-modal-toggle">
              <input
                type="checkbox"
                checked={animated}
                onChange={(e) => setAnimated(e.target.checked)}
              />
              <span className="edit-modal-toggle-slider" />
              <span style={{ marginLeft: 8, fontSize: 13 }}>Animated dashed flow</span>
            </label>
          </div>

          {/* Preview */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Preview</label>
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <svg width="240" height="60" viewBox="0 0 240 60">
                <defs>
                  <marker id="edge-preview-arrow" viewBox="0 0 10 10" refX="10" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={strokeColor} />
                  </marker>
                </defs>
                <path
                  d={edgeType === "straight" ? "M 20 30 L 220 30" :
                    edgeType === "step" ? "M 20 30 L 120 30 L 120 30 L 220 30" :
                      "M 20 30 C 80 5, 160 55, 220 30"}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={Number(strokeWidth)}
                  strokeDasharray={animated ? "5 5" : "none"}
                  markerEnd="url(#edge-preview-arrow)"
                  className={animated ? "edge-animated-preview" : ""}
                />
                {label && (
                  <text x="120" y="52" textAnchor="middle" fill="var(--foreground)" fontSize="11" fontWeight="500">
                    {label}
                  </text>
                )}
              </svg>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="edit-modal-footer">
          <button className="edit-modal-btn edit-modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="edit-modal-btn edit-modal-btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
