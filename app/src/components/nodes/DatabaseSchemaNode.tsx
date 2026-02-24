"use client";

import { memo, useState, useRef, useEffect, useCallback, type CSSProperties } from "react";
import { Handle, Position, type NodeProps, type Node, useReactFlow } from "@xyflow/react";
import type { DatabaseSchemaNodeData, SchemaColumn } from "@/lib/types";
import ShapeIcon from "@/components/ShapeIcon";

type DatabaseSchemaNodeType = Node<DatabaseSchemaNodeData, "databaseSchemaNode">;

const constraintBadge: Record<string, { label: string; color: string }> = {
  primary: { label: "PK", color: "#f59e0b" },
  foreign: { label: "FK", color: "#3b82f6" },
  unique: { label: "UQ", color: "#8b5cf6" },
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

  const columns: SchemaColumn[] = data.schema ?? [];

  const containerStyle: CSSProperties = {
    minWidth: 220,
    background: "var(--panel-bg, #ffffff)",
    border: `2px solid ${selected ? "var(--accent, #4262ff)" : "rgba(79, 70, 229, 0.3)"}`,
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: selected
      ? "0 0 0 2px var(--accent, #4262ff), 0 4px 16px var(--node-shadow-selected)"
      : "0 2px 8px var(--node-shadow), 0 0 0 1px rgba(0,0,0,0.04)",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease",
    fontSize: "12px",
    color: "var(--foreground, #1e293b)",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 12px",
    background: "#4f46e5",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
    cursor: editing ? "text" : "grab",
  };

  const rowStyle = (idx: number): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: "4px 12px",
    gap: "8px",
    background: idx % 2 === 0 ? "var(--surface, rgba(0,0,0,0.02))" : "transparent",
    borderTop: idx === 0 ? "1px solid var(--border, rgba(0,0,0,0.05))" : "none",
  });

  return (
    <div style={containerStyle}>
      <Handle type="source" id="top" position={Position.Top} style={{ width: 8, height: 8 }} />
      <Handle type="source" id="left" position={Position.Left} style={{ width: 8, height: 8 }} />

      {/* Header */}
      <div style={headerStyle} onDoubleClick={handleDoubleClick}>
        <ShapeIcon name="Table" fallback="📊" size={16} color="#fff" strokeWidth={1.5} />
        {editing ? (
          <input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#fff",
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: "4px",
              padding: "1px 6px",
              outline: "none",
              width: "100%",
            }}
          />
        ) : (
          <span>{data.label}</span>
        )}
      </div>

      {/* Columns */}
      {columns.length > 0 ? (
        <div style={{ padding: "4px 0" }}>
          {columns.map((col, idx) => (
            <div key={col.name} style={rowStyle(idx)}>
              {col.constraint && constraintBadge[col.constraint] && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    padding: "1px 4px",
                    borderRadius: "3px",
                    background: constraintBadge[col.constraint].color,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {constraintBadge[col.constraint].label}
                </span>
              )}
              <span
                style={{
                  flex: 1,
                  fontWeight: col.constraint === "primary" ? 600 : 400,
                  color: "var(--foreground, #1e293b)",
                }}
              >
                {col.name}
              </span>
              <span
                style={{
                  color: "var(--text-muted, #64748b)",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  flexShrink: 0,
                }}
              >
                {col.type}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted, #64748b)",
            textAlign: "center",
            fontStyle: "italic",
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
