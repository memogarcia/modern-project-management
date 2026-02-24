"use client";

import { useRef, useEffect, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Play } from "lucide-react";
import { useDiagramStore } from "@/store/diagramStore";
import { useTheme } from "@/components/ThemeProvider";

export default function MermaidPanel() {
  const mermaidCode = useDiagramStore((s) => s.mermaidCode);
  const updateMermaidCode = useDiagramStore((s) => s.updateMermaidCode);
  const syncMermaidToFlow = useDiagramStore((s) => s.syncMermaidToFlow);
  const { theme } = useTheme();

  const [localCode, setLocalCode] = useState(mermaidCode);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExternalUpdate = useRef(false);

  // Sync external mermaid code changes to local state
  useEffect(() => {
    isExternalUpdate.current = true;
    setLocalCode(mermaidCode);
  }, [mermaidCode]);

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
          padding: "8px 12px",
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
        <button
          onClick={() => syncMermaidToFlow()}
          style={{
            fontSize: "11px",
            padding: "3px 8px",
            background: "var(--accent)",
            color: "#fff",
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
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
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
