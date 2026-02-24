"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ArchNode } from "@/lib/types";
import { getShapeDef, SHAPE_REGISTRY, getContrastTextColor, type ShapeType } from "@/lib/types";
import ShapeIcon from "@/components/ShapeIcon";
import { useTheme } from "@/components/ThemeProvider";

interface NodeEditModalProps {
  node: ArchNode;
  onSave: (nodeId: string, data: Partial<ArchNode["data"]>) => void;
  onClose: () => void;
}

const PRESET_COLORS_LIGHT = [
  "#e3f2fd", "#e8f5e9", "#fff8e1", "#f3e5f5", "#ffebee",
  "#e0f7fa", "#f9fbe7", "#e8eaf6", "#e1f5fe", "#f5f5f5",
  "#e0f2f1", "#fafafa", "#f1f8e9", "#fff3e0", "#ede7f6",
];

const PRESET_COLORS_DARK = [
  "#1e3a5f", "#1b3a26", "#4a2f10", "#3b1f4a", "#3b1414",
  "#0f3038", "#2a3510", "#1a1f3f", "#0c2f4a", "#2a2a2a",
  "#1a332e", "#1e293b", "#263618", "#3d2b10", "#2d1f4a",
];

const PRESET_BORDER_COLORS = [
  "#2196f3", "#4caf50", "#9c27b0", "#ff9800", "#00bcd4",
  "#607d8b", "#f44336", "#cddc39", "#3f51b5", "#03a9f4",
  "#9e9e9e", "#ff5722", "#e91e63", "#009688", "#ffc107",
];

export default function NodeEditModal({ node, onSave, onClose }: NodeEditModalProps) {
  const { theme } = useTheme();
  const shape = getShapeDef(node.data.shapeType);
  const defaultBg = theme === "dark" ? shape.darkColor : shape.color;
  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description ?? "");
  const [bgColor, setBgColor] = useState(node.data.color ?? defaultBg);
  const [borderColor, setBorderColor] = useState(node.data.borderColor ?? shape.borderColor);
  const [animated, setAnimated] = useState(node.data.animated ?? false);
  const [shapeType, setShapeType] = useState<ShapeType>(node.data.shapeType);
  const overlayRef = useRef<HTMLDivElement>(null);

  const presetColors = theme === "dark" ? PRESET_COLORS_DARK : PRESET_COLORS_LIGHT;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = useCallback(() => {
    onSave(node.id, {
      label: label.trim() || node.data.label,
      description: description.trim(),
      color: bgColor,
      borderColor,
      animated,
      shapeType,
    });
    onClose();
  }, [node.id, label, description, bgColor, borderColor, animated, shapeType, onSave, onClose, node.data.label]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  const currentShapeDef = getShapeDef(shapeType);

  return (
    <div ref={overlayRef} className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div className="edit-modal" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="edit-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShapeIcon name={currentShapeDef.lucideIcon} fallback={currentShapeDef.icon} size={18} color={borderColor} strokeWidth={1.5} />
            <span>Edit Node</span>
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
              placeholder="Node label"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Description</label>
            <textarea
              className="edit-modal-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Shape Type */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Shape Type</label>
            <select
              className="edit-modal-input"
              value={shapeType}
              onChange={(e) => {
                const newType = e.target.value as ShapeType;
                setShapeType(newType);
                const def = getShapeDef(newType);
                setBgColor(theme === "dark" ? def.darkColor : def.color);
                setBorderColor(def.borderColor);
              }}
            >
              {Object.entries(SHAPE_REGISTRY).map(([key, def]) => (
                <option key={key} value={key}>{def.icon} {def.label}</option>
              ))}
            </select>
          </div>

          {/* Background Color */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Background Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "none", padding: 0 }}
              />
              {presetColors.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className="edit-modal-color-swatch"
                  style={{
                    background: c,
                    outline: bgColor === c ? "2px solid var(--accent)" : "1px solid var(--border)",
                    outlineOffset: 1,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Border Color */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Border Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <input
                type="color"
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
                style={{ width: 36, height: 36, border: "none", borderRadius: 6, cursor: "pointer", background: "none", padding: 0 }}
              />
              {PRESET_BORDER_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBorderColor(c)}
                  className="edit-modal-color-swatch"
                  style={{
                    background: c,
                    outline: borderColor === c ? "2px solid var(--accent)" : "1px solid var(--border)",
                    outlineOffset: 1,
                  }}
                />
              ))}
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
              <span style={{ marginLeft: 8, fontSize: 13 }}>Pulse glow animation</span>
            </label>
          </div>

          {/* Preview */}
          <div className="edit-modal-field">
            <label className="edit-modal-label">Preview</label>
            <div style={{
              display: "flex", justifyContent: "center", padding: "16px 0",
            }}>
              <div
                className={animated ? "node-pulse-animation" : ""}
                style={{
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 8,
                  padding: "12px 20px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  minWidth: 140,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
                }}
              >
                <ShapeIcon name={currentShapeDef.lucideIcon} fallback={currentShapeDef.icon} size={20} color={getContrastTextColor(bgColor)} strokeWidth={1.5} />
                <div style={{ fontWeight: 600, fontSize: 13, color: getContrastTextColor(bgColor), textAlign: "center" }}>
                  {label || "Untitled"}
                </div>
                {description && (
                  <div style={{ fontSize: 10, color: getContrastTextColor(bgColor) === "#ffffff" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)", textAlign: "center" }}>
                    {description}
                  </div>
                )}
              </div>
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
