"use client";

import { memo, useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import type { ArchNodeData } from "@/lib/types";
import { getShapeDef, getContrastTextColor } from "@/lib/types";
import ShapeIcon from "@/components/ShapeIcon";
import { useTheme } from "@/components/ThemeProvider";

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

  // Use custom colors from data if set, otherwise fall back to shape defaults
  const defaultBg = theme === "dark" ? shape.darkColor : shape.color;
  const nodeBg = data.color ?? defaultBg;
  const nodeBorder = data.borderColor ?? shape.borderColor;
  const isAnimated = data.animated ?? false;
  const textColor = getContrastTextColor(nodeBg);
  const textMutedColor = textColor === "#ffffff" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
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
  }, [editValue, data.label, id, updateNodeData]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(data.label);
    setEditing(true);
  }, [data.label]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitRename();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }, [commitRename]);

  const style: CSSProperties = {
    background: nodeBg,
    border: `2px solid ${selected ? "var(--accent, #3b82f6)" : nodeBorder}`,
    borderRadius: shape.mermaidShape === "cylinder" ? "12px 12px 24px 24px" :
      shape.mermaidShape === "stadium" ? "35px" :
        shape.mermaidShape === "diamond" ? "8px" :
          shape.mermaidShape === "hexagon" ? "4px" : "8px",
    padding: "12px 16px",
    minWidth: shape.defaultWidth,
    minHeight: shape.defaultHeight,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    boxShadow: selected
      ? `var(--node-shadow-selected)`
      : `var(--node-shadow)`,
    transition: "box-shadow 0.15s, border-color 0.15s",
    cursor: editing ? "text" : "grab",
    transform: shape.mermaidShape === "diamond" ? "rotate(0deg)" : undefined,
  };

  const handleStyle: CSSProperties = {
    width: 8,
    height: 8,
  };

  const targetHandleStyle: CSSProperties = {
    ...handleStyle,
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div style={style} onDoubleClick={handleDoubleClick} className={isAnimated ? "node-pulse-animation" : ""}>
      <Handle type="target" id="t-top" position={Position.Top} style={targetHandleStyle} />
      <Handle type="target" id="t-left" position={Position.Left} style={targetHandleStyle} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} style={targetHandleStyle} />
      <Handle type="target" id="t-right" position={Position.Right} style={targetHandleStyle} />

      <Handle type="source" id="top" position={Position.Top} style={handleStyle} />
      <Handle type="source" id="left" position={Position.Left} style={handleStyle} />
      <div
        style={{
          lineHeight: 1,
          filter: textColor === "#ffffff" ? "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" : "none",
        }}
      >
        <ShapeIcon
          type={data.shapeType}
          size={20}
          color={textColor}
          strokeWidth={1.5}
        />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={handleKeyDown}
          style={{
            fontWeight: 600,
            fontSize: "13px",
            color: textColor,
            textAlign: "center",
            background: textColor === "#ffffff" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
            border: textColor === "#ffffff" ? "1px solid rgba(255,255,255,0.3)" : "1px solid rgba(0,0,0,0.15)",
            borderRadius: "4px",
            padding: "2px 6px",
            outline: "none",
            width: Math.max(60, shape.defaultWidth - 40),
          }}
        />
      ) : (
        <div
          style={{
            fontWeight: 600,
            fontSize: "13px",
            color: textColor,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: shape.defaultWidth - 32,
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
            fontSize: "10px",
            color: textMutedColor,
            textAlign: "center",
            maxWidth: shape.defaultWidth - 32,
            whiteSpace: "pre-line",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            lineHeight: 1.25,
          }}
        >
          {displayDescription}
        </div>
      )}
      <Handle type="source" id="bottom" position={Position.Bottom} style={handleStyle} />
      <Handle type="source" id="right" position={Position.Right} style={handleStyle} />
    </div>
  );
}

export default memo(ArchNodeComponent);
