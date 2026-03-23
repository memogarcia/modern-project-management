"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useReactFlow } from "@xyflow/react";
import { PanelRightClose, Play } from "lucide-react";
import { useDiagramStore } from "@/store/diagramStore";
import { useTheme } from "@/components/ThemeProvider";

export default function MermaidPanel(props: { onCollapse?: () => void }) {
  const mermaidCode = useDiagramStore((s) => s.mermaidCode);
  const mermaidError = useDiagramStore((s) => s.mermaidError);
  const mermaidDiagnostics = useDiagramStore((s) => s.mermaidDiagnostics);
  const updateMermaidCode = useDiagramStore((s) => s.updateMermaidCode);
  const syncMermaidToFlow = useDiagramStore((s) => s.syncMermaidToFlow);
  const { theme } = useTheme();
  const { fitView } = useReactFlow();

  const [localCode, setLocalCode] = useState(mermaidCode);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdate = useRef(false);

  // Sync external mermaid code changes to local state
  useEffect(() => {
    isExternalUpdate.current = true;
    setLocalCode(mermaidCode);
  }, [mermaidCode]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleApply = useCallback(async () => {
    await syncMermaidToFlow();
    requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 250 });
    });
  }, [syncMermaidToFlow, fitView]);

  const handleChange = (value: string | undefined) => {
    const code = value ?? "";
    isExternalUpdate.current = false;
    setLocalCode(code);
    updateMermaidCode(code);

    // Debounce sync
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      syncMermaidToFlow();
    }, 600);
  };

  const handleEditorMount: OnMount = (editor) => {
    editor.updateOptions({
      fontSize: 13,
      lineHeight: 20,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      lineNumbers: "on",
      renderLineHighlight: "gutter",
      bracketPairColorization: { enabled: true },
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--panel-bg)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          height: 60,
          padding: "0 12px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Mermaid
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => void handleApply()}
            style={{
              fontSize: "11px",
              padding: "3px 8px",
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <Play size={12} /> Apply
          </button>
          {props.onCollapse && (
            <button
              onClick={props.onCollapse}
              aria-label="Collapse Mermaid panel"
              title="Collapse Mermaid panel"
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {mermaidError && (
          <div
            style={{
              borderBottom: "1px solid color-mix(in srgb, var(--danger) 32%, var(--border))",
              background: "color-mix(in srgb, var(--danger) 12%, var(--panel-bg))",
              color: "var(--danger)",
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <div>{mermaidError}</div>
            {mermaidDiagnostics.length > 0 && (
              <div style={{ marginTop: 6, fontWeight: 500 }}>
                {mermaidDiagnostics.slice(0, 4).map((diagnostic) => (
                  <div key={`${diagnostic.line}:${diagnostic.message}`}>
                    Line {diagnostic.line}: {diagnostic.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={localCode}
          onChange={handleChange}
          onMount={handleEditorMount}
          theme={theme === "dark" ? "vs-dark" : "light"}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}
