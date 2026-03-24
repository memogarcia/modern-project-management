"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, type Node, type NodeProps, useReactFlow, useViewport } from "@xyflow/react";
import ShapeIcon from "@/components/ShapeIcon";
import { useTheme } from "@/components/ThemeProvider";
import { getCanvasRenderMode } from "@/lib/canvasRenderMode";
import { getContrastTextColor, getShapeDef, type ArchNodeData } from "@/lib/types";

type ArchNodeType = Node<ArchNodeData, "archNode">;

function formatDisplayText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function ArchNodeComponent({ id, data, selected }: NodeProps<ArchNodeType>) {
  const shape = getShapeDef(data.shapeType);
  const { theme } = useTheme();
  const { updateNodeData } = useReactFlow();
  const { zoom } = useViewport();
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
  const renderBadgeLabel = typeof data.renderBadgeLabel === "string" ? data.renderBadgeLabel : "";
  const renderBadgeTone = data.renderBadgeTone === "info" ? "info" : "warning";
  const renderBadgeTooltip = typeof data.renderBadgeTooltip === "string" ? data.renderBadgeTooltip : undefined;
  const renderMode = getCanvasRenderMode(zoom);
  const isCompact = renderMode !== "full";
  const isMicro = renderMode === "micro";
  const padding = isMicro ? 8 : isCompact ? 10 : 14;
  const gap = isMicro ? 8 : isCompact ? 10 : 12;
  const iconBoxSize = isMicro ? 28 : isCompact ? 34 : 40;
  const iconSize = isMicro ? 14 : isCompact ? 16 : 18;
  const labelFontSize = isMicro ? 12 : isCompact ? 13 : 14;
  const descriptionFontSize = isCompact ? 10 : 11;
  const containerBackground = isCompact
    ? theme === "dark"
      ? `color-mix(in srgb, ${nodeBg} 12%, #101a2b)`
      : `color-mix(in srgb, ${nodeBg} 10%, white 90%)`
    : theme === "dark"
      ? `linear-gradient(180deg, color-mix(in srgb, ${nodeBg} 16%, #17253b) 0%, color-mix(in srgb, ${nodeBg} 8%, #101a2b) 100%)`
      : `linear-gradient(180deg, color-mix(in srgb, ${nodeBg} 14%, white 86%) 0%, color-mix(in srgb, ${nodeBg} 8%, white 92%) 100%)`;

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
    gap,
    padding,
    borderRadius,
    border: `1.5px solid ${selected ? "var(--accent)" : nodeBorder}`,
    background: containerBackground,
    boxShadow: isCompact ? "none" : selected ? "var(--node-shadow-selected)" : "var(--node-shadow)",
    cursor: editing ? "text" : "grab",
    transition: "box-shadow 0.2s ease, border-color 0.2s ease",
    position: "relative",
  };

  const handleStyle: CSSProperties = {
    width: isCompact ? 8 : 10,
    height: isCompact ? 8 : 10,
    opacity: isCompact ? 0.24 : 0.42,
  };

  const targetHandleStyle: CSSProperties = {
    ...handleStyle,
    opacity: 0,
    pointerEvents: "none",
  };

  return (
    <div style={containerStyle} onDoubleClick={handleDoubleClick} className={isAnimated ? "node-pulse-animation" : ""}>
      {renderBadgeLabel && (
        <div
          title={renderBadgeTooltip}
          style={{
            position: "absolute",
            top: -10,
            right: 10,
            zIndex: 2,
            borderRadius: 999,
            border: `1px solid ${
              renderBadgeTone === "warning"
                ? "color-mix(in srgb, var(--warning) 38%, var(--border))"
                : "color-mix(in srgb, var(--accent) 32%, var(--border))"
            }`,
            background:
              renderBadgeTone === "warning"
                ? "color-mix(in srgb, var(--warning) 12%, var(--surface))"
                : "color-mix(in srgb, var(--accent) 10%, var(--surface))",
            color: "var(--foreground)",
            padding: isCompact ? "2px 6px" : "3px 8px",
            fontSize: isCompact ? 9 : 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            boxShadow: isCompact ? "none" : "var(--card-shadow)",
            whiteSpace: "nowrap",
          }}
        >
          {renderBadgeLabel}
        </div>
      )}
      <Handle type="target" id="t-top" position={Position.Top} style={targetHandleStyle} />
      <Handle type="target" id="t-left" position={Position.Left} style={targetHandleStyle} />
      <Handle type="target" id="t-bottom" position={Position.Bottom} style={targetHandleStyle} />
      <Handle type="target" id="t-right" position={Position.Right} style={targetHandleStyle} />

      <Handle type="source" id="top" position={Position.Top} style={handleStyle} />
      <Handle type="source" id="left" position={Position.Left} style={handleStyle} />

      <div
        style={{
          flexShrink: 0,
          width: iconBoxSize,
          height: iconBoxSize,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: nodeBg,
          color: badgeTextColor,
          boxShadow: isCompact ? "none" : "inset 0 1px 0 rgba(255,255,255,0.16)",
        }}
      >
        <ShapeIcon type={data.shapeType} size={iconSize} color={badgeTextColor} strokeWidth={1.7} />
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
              background: "var(--surface)",
              padding: isCompact ? "6px 8px" : "8px 10px",
              fontSize: labelFontSize,
              fontWeight: 700,
              color: "var(--foreground)",
              outline: "none",
            }}
          />
        ) : (
          <div
            style={{
              color: "var(--foreground)",
              fontSize: labelFontSize,
              fontWeight: 700,
              lineHeight: isCompact ? 1.25 : 1.35,
              letterSpacing: "-0.02em",
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              ...(isCompact
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: isMicro ? 2 : 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }
                : {}),
            }}
          >
            {displayLabel}
          </div>
        )}

        {data.description && !isCompact && (
          <div
            style={{
              color: "var(--text-muted)",
              fontSize: descriptionFontSize,
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
