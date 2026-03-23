"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import ShapeIcon from "@/components/ShapeIcon";
import type { DatabaseSchemaNodeData, SchemaColumn } from "@/lib/types";

type DatabaseSchemaNodeType = Node<DatabaseSchemaNodeData, "databaseSchemaNode">;

const constraintBadge: Record<string, { label: string; color: string }> = {
  primary: { label: "PK", color: "#e58f12" },
  foreign: { label: "FK", color: "#4262ff" },
  unique: { label: "UQ", color: "#8a63ff" },
  nullable: { label: "N", color: "#6b7280" },
};

function DatabaseSchemaNodeComponent({ id, data, selected }: NodeProps<DatabaseSchemaNodeType>) {
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

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
      else if (event.key === "Escape") setEditing(false);
    },
    [commitRename]
  );

  const columns: SchemaColumn[] = data.schema ?? [];

  const containerStyle: CSSProperties = {
    minWidth: 240,
    overflow: "hidden",
    borderRadius: 8,
    border: `1.5px solid ${selected ? "var(--accent)" : "color-mix(in srgb, var(--accent) 18%, var(--border))"}`,
    background: "var(--surface-raised)",
    boxShadow: selected ? "var(--node-shadow-selected)" : "var(--node-shadow)",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 16px",
    background: "linear-gradient(180deg, color-mix(in srgb, var(--accent) 92%, white) 0%, var(--accent) 100%)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "-0.02em",
    cursor: editing ? "text" : "grab",
  };

  const rowStyle = (index: number): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 14px",
    background: index % 2 === 0 ? "color-mix(in srgb, var(--accent) 3%, var(--surface-raised))" : "transparent",
    borderTop: index === 0 ? "1px solid color-mix(in srgb, var(--accent) 12%, var(--border))" : "none",
  });

  const targetHandleStyle: CSSProperties = {
    width: 8,
    height: 8,
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle}>
      <Handle type="target" id="t-top" position={Position.Top} style={targetHandleStyle} />
      <Handle type="target" id="t-left" position={Position.Left} style={targetHandleStyle} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} style={targetHandleStyle} />
      <Handle type="target" id="t-right" position={Position.Right} style={targetHandleStyle} />

      <Handle type="source" id="top" position={Position.Top} style={{ width: 8, height: 8 }} />
      <Handle type="source" id="left" position={Position.Left} style={{ width: 8, height: 8 }} />

      <div style={headerStyle} onDoubleClick={handleDoubleClick}>
        <div
          style={{
            display: "flex",
            width: 28,
            height: 28,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            background: "rgba(255,255,255,0.16)",
          }}
        >
          <ShapeIcon type="database" size={16} color="#fff" strokeWidth={1.5} />
        </div>

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
              border: "1px solid rgba(255,255,255,0.28)",
              background: "rgba(255,255,255,0.14)",
              padding: "6px 8px",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              outline: "none",
            }}
          />
        ) : (
          <span>{data.label}</span>
        )}
      </div>

      {columns.length > 0 ? (
        <div style={{ padding: "6px 0" }}>
          {columns.map((column, index) => (
            <div key={column.name} style={rowStyle(index)}>
              {column.constraint && constraintBadge[column.constraint] && (
                <span
                  style={{
                    flexShrink: 0,
                    borderRadius: 999,
                    background: constraintBadge[column.constraint].color,
                    color: "#fff",
                    padding: "2px 6px",
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  }}
                >
                  {constraintBadge[column.constraint].label}
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  color: "var(--foreground)",
                  fontWeight: column.constraint === "primary" ? 700 : 500,
                  fontSize: 12,
                }}
              >
                {column.name}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  color: "var(--text-muted)",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 11,
                }}
              >
                {column.type}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          No columns defined
        </div>
      )}

      <Handle type="source" id="bottom" position={Position.Bottom} style={{ width: 8, height: 8 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ width: 8, height: 8 }} />
    </div>
  );
}

export default memo(DatabaseSchemaNodeComponent);
