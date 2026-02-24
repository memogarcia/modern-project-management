"use client";

import { memo, useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { type NodeProps, type Node, useReactFlow, NodeResizer } from "@xyflow/react";
import type { GroupNodeData } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";

type GroupNodeType = Node<GroupNodeData, "groupNode">;

const LIGHT_DEFAULT_COLOR = "rgba(241, 245, 249, 0.5)"; // Slate 100 with opacity
const DARK_DEFAULT_COLOR = "rgba(30, 41, 59, 0.5)"; // Slate 800 with opacity
const LIGHT_DEFAULT_BORDER = "#94a3b8"; // Slate 400
const DARK_DEFAULT_BORDER = "#64748b"; // Slate 500

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
  }, [editValue, data.label, id, updateNodeData]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditValue(data.label);
      setEditing(true);
    },
    [data.label],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") commitRename();
      else if (e.key === "Escape") setEditing(false);
    },
    [commitRename],
  );

  const containerStyle: CSSProperties = {
    background: bgColor,
    border: `2px dashed ${selected ? "var(--accent, #3b82f6)" : borderColor}`,
    borderRadius: "12px",
    width: "100%",
    height: "100%",
    minWidth: 200,
    minHeight: 120,
    position: "relative",
  };

  const labelStyle: CSSProperties = {
    position: "absolute",
    top: "8px",
    left: "12px",
    fontSize: "11px",
    fontWeight: 600,
    color: borderColor,
    letterSpacing: "0.3px",
    textTransform: "uppercase",
    pointerEvents: "auto",
  };

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ borderColor }}
        handleStyle={{ width: 8, height: 8, borderColor }}
      />
      <div style={containerStyle}>
        <div
          style={labelStyle}
          onDoubleClick={handleDoubleClick}
          className="drag-handle"
        >
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                fontSize: "inherit",
                fontWeight: "inherit",
                letterSpacing: "inherit",
                textTransform: "inherit" as CSSProperties["textTransform"],
                outline: "1px solid " + borderColor,
                borderRadius: "3px",
                padding: "1px 4px",
                width: "120px",
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
