"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
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
  }, [fitView, syncMermaidToFlow]);

  const handleChange = (value: string | undefined) => {
    const code = value ?? "";
    setLocalCode(code);
    updateMermaidCode(code);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void syncMermaidToFlow();
    }, 600);
  };

  const handleEditorMount: OnMount = (editor) => {
    editor.updateOptions({
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: "on",
      lineNumbers: "on",
      renderLineHighlight: "gutter",
      bracketPairColorization: { enabled: true },
      padding: { top: 14, bottom: 14 },
    });
  };

  return (
    <div className="flex h-full flex-col bg-[var(--surface-raised)]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Mermaid source
          </div>
          <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
            Text-to-canvas sync
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            Update the source and the board refreshes in place.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleApply()}
            className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_16px_28px_rgba(66,98,255,0.18)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Play size={15} />
            Apply
          </button>
          {props.onCollapse && (
            <button
              type="button"
              onClick={props.onCollapse}
              aria-label="Collapse Mermaid panel"
              title="Collapse Mermaid panel"
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            >
              <PanelRightClose size={18} />
            </button>
          )}
        </div>
      </div>

      {mermaidError && (
        <div className="border-b border-[color:color-mix(in_srgb,var(--danger)_32%,var(--border))] bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface-raised))] px-4 py-3 text-sm text-[var(--danger)]">
          <div className="font-semibold">{mermaidError}</div>
          {mermaidDiagnostics.length > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              {mermaidDiagnostics.slice(0, 4).map((diagnostic) => (
                <div key={`${diagnostic.line}:${diagnostic.message}`}>
                  Line {diagnostic.line}: {diagnostic.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-hidden">
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
