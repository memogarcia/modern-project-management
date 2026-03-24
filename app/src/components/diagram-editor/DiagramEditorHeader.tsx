"use client";

import type { DiagramQualitySummary } from "@/lib/diagramQuality";

interface DiagramEditorHeaderProps {
  diagramName: string;
  theme: string;
  qualitySummary: DiagramQualitySummary;
  activePerspectiveTitle: string | null;
  onClearPerspective: () => void;
}

export default function DiagramEditorHeader({
  diagramName,
  theme,
  qualitySummary,
  activePerspectiveTitle,
  onClearPerspective,
}: DiagramEditorHeaderProps) {
  return (
    <div className="flex min-h-[44px] shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-3 py-2 md:min-h-[52px] md:px-4">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Canvas workspace
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2.5 md:gap-3">
          <a
            href="/diagrams"
            className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--foreground)] md:px-3 md:text-xs"
          >
            Diagrams
          </a>
          <span className="truncate text-base font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-lg">
            {diagramName}
          </span>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <span
          className="rounded-full border px-3 py-1.5 text-xs font-medium"
          style={{
            borderColor:
              qualitySummary.warningCount > 0
                ? "color-mix(in srgb, var(--warning) 32%, var(--border))"
                : "color-mix(in srgb, var(--success) 28%, var(--border))",
            background:
              qualitySummary.warningCount > 0
                ? "color-mix(in srgb, var(--warning) 10%, var(--panel-bg))"
                : "color-mix(in srgb, var(--success) 10%, var(--panel-bg))",
            color: "var(--foreground)",
          }}
        >
          Quality {qualitySummary.score} / 100
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
          {qualitySummary.warningCount} warnings · {qualitySummary.infoCount} notes
        </span>
        {activePerspectiveTitle && (
          <button
            type="button"
            className="rounded-full border border-[color:color-mix(in_srgb,var(--accent)_32%,var(--border))] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]"
            onClick={onClearPerspective}
          >
            View: {activePerspectiveTitle}
          </button>
        )}
        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
          Grid snap enabled
        </span>
        <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
          {theme === "dark" ? "Dark workspace" : "Light workspace"}
        </span>
      </div>
    </div>
  );
}
