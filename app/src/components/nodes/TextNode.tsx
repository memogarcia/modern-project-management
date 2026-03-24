"use client";

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { type Node, type NodeProps, useReactFlow, useViewport } from "@xyflow/react";
import { getCanvasRenderMode } from "@/lib/canvasRenderMode";
import type { TextNodeData } from "@/lib/types";

type TextNodeType = Node<TextNodeData, "textNode">;

function formatDisplayText(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function TextNodeComponent({ id, data, selected }: NodeProps<TextNodeType>) {
  const { updateNodeData } = useReactFlow();
  const { zoom } = useViewport();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayText = formatDisplayText(data.text ?? "");
  const renderMode = getCanvasRenderMode(zoom);
  const isCompact = renderMode !== "full";
  const isMicro = renderMode === "micro";
  const padding = isMicro ? "8px 10px" : isCompact ? "9px 11px" : "10px 12px";
  const textFontSize = data.fontSize ?? 16;

  useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (editing) return;
    setDraft(data.text ?? "");
  }, [data.text, editing]);

  const commit = useCallback(() => {
    const next = draft;
    if (next !== (data.text ?? "")) {
      updateNodeData(id, { text: next });
    }
    setEditing(false);
  }, [data.text, draft, id, updateNodeData]);

  const cancel = useCallback(() => {
    setDraft(data.text ?? "");
    setEditing(false);
  }, [data.text]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(data.text ?? "");
    setEditing(true);
  }, [data.text]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancel();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  }, [cancel, commit]);

  const style: CSSProperties = {
    padding,
    borderRadius: 8,
    border: selected
      ? "1.5px solid var(--accent)"
      : isCompact
        ? "1px solid color-mix(in srgb, var(--border) 82%, transparent)"
        : "1px solid transparent",
    background: data.backgroundColor ?? "rgba(255, 241, 184, 0.88)",
    color: data.color ?? "var(--foreground)",
    boxShadow: isCompact ? "none" : selected ? "var(--node-shadow-selected)" : "var(--node-shadow)",
    cursor: editing ? "text" : "grab",
    minWidth: 80,
    maxWidth: 420,
    userSelect: editing ? "text" : "none",
  };

  if (editing) {
    return (
      <div style={style} onDoubleClick={onDoubleClick}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          rows={Math.min(10, Math.max(1, (draft.match(/\n/g)?.length ?? 0) + 1))}
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            resize: "none",
            background: "transparent",
            color: "inherit",
            fontSize: textFontSize,
            lineHeight: 1.3,
            fontFamily: "inherit",
            padding: 0,
          }}
        />
      </div>
    );
  }

  return (
    <div style={style} onDoubleClick={onDoubleClick}>
      <div
        style={{
          fontSize: textFontSize,
          lineHeight: 1.3,
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
        {displayText || "Text"}
      </div>
    </div>
  );
}

export default memo(TextNodeComponent);
