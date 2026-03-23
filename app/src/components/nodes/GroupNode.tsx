"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { NodeResizer, type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import { useTheme } from "@/components/ThemeProvider";
import type { GroupNodeData } from "@/lib/types";

type GroupNodeType = Node<GroupNodeData, "groupNode">;

const LIGHT_DEFAULT_COLOR = "rgba(66, 98, 255, 0.08)";
const DARK_DEFAULT_COLOR = "rgba(107, 132, 255, 0.1)";
const LIGHT_DEFAULT_BORDER = "rgba(66, 98, 255, 0.42)";
const DARK_DEFAULT_BORDER = "rgba(144, 163, 255, 0.46)";

function GroupNodeComponent({ id, data, selected }: NodeProps<GroupNodeType>) {
  const { updateNodeData } = useReactFlow();
  const { theme } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  const bgColor = data.color ?? (theme === "dark" ? DARK_DEFAULT_COLOR : LIGHT_DEFAULT_COLOR);
  const borderColor = data.borderColor ?? (theme === "dark" ? DARK_DEFAULT_BORDER : LIGHT_DEFAULT_BORDER);

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
      if (event.key === "Enter") commitRename();
      if (event.key === "Escape") setEditing(false);
    },
    [commitRename]
  );

  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    minWidth: 220,
    minHeight: 140,
    position: "relative",
    borderRadius: 28,
    border: `1.5px dashed ${selected ? "var(--accent)" : borderColor}`,
    background: `linear-gradient(180deg, ${bgColor} 0%, color-mix(in srgb, ${bgColor} 72%, transparent) 100%)`,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
    backdropFilter: "blur(8px)",
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: 14,
    left: 16,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    border: `1px solid color-mix(in srgb, ${borderColor} 32%, transparent)`,
    background: "var(--surface-raised)",
    color: "var(--foreground)",
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: "-0.02em",
    pointerEvents: "auto",
    boxShadow: "0 10px 20px rgba(15, 23, 42, 0.08)",
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineStyle={{ borderColor }}
        handleStyle={{ width: 10, height: 10, borderColor, background: "var(--surface-raised)" }}
      />
      <div style={containerStyle}>
        <div style={labelStyle} onDoubleClick={handleDoubleClick} className="drag-handle">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: borderColor,
              flexShrink: 0,
            }}
          />
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(event) => setEditValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              style={{
                width: 140,
                border: "none",
                outline: "1px solid var(--accent)",
                borderRadius: 8,
                padding: "2px 6px",
                background: "transparent",
                color: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
              }}
            />
          ) : (
            data.label
          )}
        </div>
      </div>
    </>
  );
}

export default memo(GroupNodeComponent);
