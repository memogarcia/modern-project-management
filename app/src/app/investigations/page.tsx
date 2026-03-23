"use client";

import { useState } from "react";
import Link from "next/link";
import { useInvestigations } from "@/hooks/useInvestigations";

export default function InvestigationsPage() {
  const [query, setQuery] = useState("");
  const sessionsQuery = useInvestigations({ q: query || undefined });

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex h-10 items-center border-b border-[var(--border)] px-4 shrink-0">
        <span className="text-sm font-semibold">Investigations</span>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Troubleshooting investigations</h1>
            <p className="max-w-2xl text-sm text-[var(--text-muted)]">
              Review durable investigation history, linked components, commands, and resolutions across diagrams.
            </p>
          </div>

          <input
            className="edit-modal-input max-w-xl"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by symptom, note, or resolution"
          />

          {sessionsQuery.error && (
            <div className="rounded-md border border-[var(--danger)] bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
              {sessionsQuery.error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {sessionsQuery.data.map((session) => (
              <div key={session.id} className="rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-base font-semibold">{session.title}</div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    {session.status}
                  </div>
                </div>
                <div className="text-sm text-[var(--text-muted)]">{session.summary}</div>
                <div className="mt-3 text-xs text-[var(--text-muted)]">
                  {session.linkedNodeIds.length} linked nodes · {session.linkedEdgeIds.length} linked edges
                </div>
                <div className="mt-4 flex items-center gap-3 text-xs">
                  <Link className="text-[var(--accent)] hover:underline" href={`/diagrams/${session.diagramId}`}>
                    Open diagram
                  </Link>
                  <span className="text-[var(--text-muted)]">Updated {new Date(session.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
            {!sessionsQuery.isLoading && sessionsQuery.data.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-5 py-10 text-sm text-[var(--text-muted)]">
                No investigations found yet. Create one from a diagram to start building reusable troubleshooting memory.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
