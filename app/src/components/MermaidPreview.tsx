"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

let mermaidRenderCounter = 0;

export default function MermaidPreview(props: {
  code: string;
  emptyLabel?: string;
}) {
  const { theme } = useTheme();
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const renderKey = useMemo(() => `planview-mermaid-${++mermaidRenderCounter}`, []);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      if (!props.code.trim()) {
        setSvg("");
        setError(null);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: theme === "dark" ? "dark" : "default",
        });

        const { svg: nextSvg } = await mermaid.render(`${renderKey}-${Date.now()}`, props.code);
        if (!cancelled) {
          setSvg(nextSvg);
          setError(null);
        }
      } catch (renderError) {
        if (!cancelled) {
          setSvg("");
          setError(renderError instanceof Error ? renderError.message : "Failed to render Mermaid");
        }
      }
    }

    void renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [props.code, renderKey, theme]);

  if (!props.code.trim()) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)]">
        {props.emptyLabel ?? "Nothing to render yet."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[color:color-mix(in_srgb,var(--danger)_28%,var(--border))] bg-[color:color-mix(in_srgb,var(--danger)_8%,var(--surface))] px-4 py-4 text-sm text-[var(--danger)]">
        Mermaid render failed: {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div
        className="overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
