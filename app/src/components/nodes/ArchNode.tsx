"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import ShapeIcon from "@/components/ShapeIcon";
import { useTheme } from "@/components/ThemeProvider";
import { getContrastTextColor, getShapeDef, type ArchNodeData } from "@/lib/types";

type ArchNodeType = Node<ArchNodeData, "archNode">;

function formatDisplayText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function ArchNodeComponent({ id, data, selected }: NodeProps<ArchNodeType>) {
  const shape = getShapeDef(data.shapeType);
  const { theme } = useTheme();
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultBg = theme === "dark" ? shape.darkColor : shape.color;
  const nodeBg = data.color ?? defaultBg;
  const nodeBorder = data.borderColor ?? shape.borderColor;
  const isAnimated = data.animated ?? false;
  const badgeTextColor = getContrastTextColor(nodeBg);
  const displayLabel = formatDisplayText(data.label);
  const displayDescription = data.description ? formatDisplayText(data.description) : "";

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.label) {
      updateNodeData(id, { label: trimmed });
    }
    setEditing(false);
  }, [data.label, editValue, id, updateNodeData]);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      setEditValue(data.label);
      setEditing(true);
    },
    [data.label]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter") {
        commitRename();
      } else if (event.key === "Escape") {
        setEditing(false);
      }
    },
    [commitRename]
  );

  const borderRadius =
    shape.mermaidShape === "cylinder"
      ? "8px 8px 12px 12px"
      : shape.mermaidShape === "stadium"
        ? "999px"
        : shape.mermaidShape === "diamond"
          ? "10px"
          : shape.mermaidShape === "hexagon"
            ? "10px"
            : "8px";

  const containerStyle: CSSProperties = {
    minWidth: shape.defaultWidth,
    minHeight: shape.defaultHeight,
    display: "flex",
    alignItems: "stretch",
    gap: 12,
    padding: "14px",
    borderRadius,
    border: `1.5px solid ${selected ? "var(--accent)" : nodeBorder}`,
    background:
      theme === "dark"
        ? `linear-gradient(180deg, color-mix(in srgb, ${nodeBg} 16%, #17253b) 0%, color-mix(in srgb, ${nodeBg} 8%, #101a2b) 100%)`
        : `linear-gradient(180deg, color-mix(in srgb, ${nodeBg} 14%, white 86%) 0%, color-mix(in srgb, ${nodeBg} 8%, white 92%) 100%)`,
    boxShadow: selected ? "var(--node-shadow-selected)" : "var(--node-shadow)",
    cursor: editing ? "text" : "grab",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
    backdropFilter: "blur(10px)",
  };

  const handleStyle: CSSProperties = {
    width: 10,
    height: 10,
    opacity: 0.42,
  };

  const targetHandleStyle: CSSProperties = {
    ...handleStyle,
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle} onDoubleClick={handleDoubleClick} className={isAnimated ? "node-pulse-animation" : ""}>
      <Handle type="target" id="t-top" position={Position.Top} style={targetHandleStyle} />
      <Handle type="target" id="t-left" position={Position.Left} style={targetHandleStyle} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} style={targetHandleStyle} />
      <Handle type="target" id="t-right" position={Position.Right} style={targetHandleStyle} />

      <Handle type="source" id="top" position={Position.Top} style={handleStyle} />
      <Handle type="source" id="left" position={Position.Left} style={handleStyle} />

      <div
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: nodeBg,
          color: badgeTextColor,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
        }}
      >
        <ShapeIcon type={data.shapeType} size={18} color={badgeTextColor} strokeWidth={1.7} />
      </div>

      <div style={{ minWidth: 0, display: "flex", flex: 1, flexDirection: "column", justifyContent: "center", gap: 4 }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(event) => setEditValue(event.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.8)",
              padding: "8px 10px",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
        ) : (
          <div
            style={{
              color: "var(--foreground)",
              fontSize: 14,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: "-0.02em",
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {displayLabel}
          </div>
        )}

        {data.description && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              lineHeight: 1.45,
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            {displayDescription}
          </div>
        )}
      </div>

      <Handle type="source" id="bottom" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" id="right" position={Position.Right} style={handleStyle} />
    </div>
  );
}

export default memo(ArchNodeComponent);
