"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { KnowledgePattern } from "@/lib/types";
import { listPatterns } from "@/lib/investigationStorage";

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<KnowledgePattern[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPatterns()
      .then(setPatterns)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load patterns"));
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0">
        <span className="text-sm font-semibold">Patterns</span>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Reusable troubleshooting patterns</h1>
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">
              Extracted patterns distill symptoms and fixes from resolved investigations so future incidents start with prior context instead of a blank page.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-5">
                <div className="text-base font-semibold">{pattern.title}</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">{pattern.summary}</div>
                <div className="mt-3 text-xs text-[var(--text-muted)]">Symptom: {pattern.symptom}</div>
                <div className="mt-2 text-xs text-[var(--text-muted)]">Resolution: {pattern.resolution}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pattern.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs">
                  <Link className="text-[var(--accent)] hover:underline" href={`/investigations`}>
                    Review source investigations
                  </Link>
                </div>
              </div>
            ))}
            {patterns.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-10 text-sm text-[var(--text-muted)]">
                No reusable patterns yet. Resolve an investigation and extract the fix pattern from the diagram sidebar.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

