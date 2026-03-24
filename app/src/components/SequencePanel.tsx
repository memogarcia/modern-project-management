"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, GitBranch, ListTree } from "lucide-react";
import MermaidPreview from "@/components/MermaidPreview";
import { useInvestigations } from "@/hooks/useInvestigations";
import { buildSequenceView } from "@/lib/diagramSequence";
import type { ArchEdge, DiagramNode } from "@/lib/types";

interface SequencePanelProps {
  diagramId: string;
  nodes: DiagramNode[];
  edges: ArchEdge[];
}

export default function SequencePanel({ diagramId, nodes, edges }: SequencePanelProps) {
  const investigations = useInvestigations({ diagramId });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    if (investigations.data.length === 0) {
      setSelectedSessionId(null);
      return;
    }

    setSelectedSessionId((current) =>
      current && investigations.data.some((session) => session.id === current)
        ? current
        : investigations.data[0]!.id
    );
  }, [investigations.data]);

  const selectedSession = useMemo(
    () => investigations.data.find((session) => session.id === selectedSessionId) ?? null,
    [investigations.data, selectedSessionId]
  );

  const sequenceView = useMemo(
    () => (selectedSession ? buildSequenceView(selectedSession, nodes, edges) : null),
    [edges, nodes, selectedSession]
  );

  return (
    <div className="flex h-full flex-col bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Sequence
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
          Derive an interaction view from investigations and dependency semantics
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          This complements the topology view. Use it when time and order matter more than layout.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {investigations.data.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)]">
              No investigations yet. Create one and link nodes or edges to derive a sequence view.
            </div>
          ) : (
            <>
              <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
                <div className="grid gap-3">
                  <select
                    className="edit-modal-input"
                    value={selectedSessionId ?? ""}
                    onChange={(event) => setSelectedSessionId(event.target.value || null)}
                  >
                    {investigations.data.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.title}
                      </option>
                    ))}
                  </select>

                  {selectedSession && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Status
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {selectedSession.status}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Linked nodes
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {selectedSession.linkedNodeIds.length}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          Timeline
                        </div>
                        <div className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                          {selectedSession.timelineEntries.length} entries
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Mermaid preview
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      Generated from linked dependencies, commands, and investigation timeline notes.
                    </div>
                  </div>

                  {sequenceView && (
                    <button
                      type="button"
                      className="edit-modal-btn edit-modal-btn-secondary"
                      onClick={async () => {
                        await navigator.clipboard.writeText(sequenceView.mermaidCode);
                        setCopyState("copied");
                        window.setTimeout(() => setCopyState("idle"), 1200);
                      }}
                    >
                      <Copy size={14} />
                      {copyState === "copied" ? "Copied" : "Copy code"}
                    </button>
                  )}
                </div>

                <MermaidPreview
                  code={sequenceView?.mermaidCode ?? ""}
                  emptyLabel="Select an investigation to generate a sequence view."
                />
              </section>

              {sequenceView && (
                <>
                  <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      <GitBranch size={13} />
                      Participants
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sequenceView.participants.map((participant) => (
                        <span
                          key={participant.id}
                          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--foreground)]"
                        >
                          {participant.label}
                        </span>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      <ListTree size={13} />
                      Derived steps
                    </div>

                    <div className="space-y-2">
                      {sequenceView.steps.map((step) => (
                        <div key={step.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                              {step.kind}
                            </span>
                            <div className="text-sm font-medium text-[var(--foreground)]">
                              {step.label}
                            </div>
                          </div>
                          {step.detail && (
                            <div className="mt-1 text-xs text-[var(--text-muted)]">
                              {step.detail}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                      Mermaid source
                    </div>
                    <pre className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-6 text-[var(--foreground)]">
                      {sequenceView.mermaidCode}
                    </pre>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
