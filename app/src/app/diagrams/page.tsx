"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Grid2x2Plus, Layers3, Plus, Trash2 } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { Diagram, DiagramMeta } from "@/lib/types";
import { deleteDiagram, loadDiagrams, saveDiagram } from "@/lib/storage";
import { createEmptyDiagramDocument } from "@planview/domain";

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DiagramsListPage() {
  const router = useRouter();
  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    void loadDiagrams().then(setDiagrams);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;

    setActionError(null);

    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      await saveDiagram(
        createEmptyDiagramDocument({
          id,
          name: newName.trim(),
          description: newDesc.trim(),
          mermaidCode: "graph TD\n",
          createdAt: now,
        }) as Diagram
      );
      router.push(`/diagrams/${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create diagram";
      setActionError(message);
      console.error("Failed to create diagram", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this diagram?")) return;

    setActionError(null);
    try {
      await deleteDiagram(id);
      setDiagrams(await loadDiagrams());
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete diagram";
      setActionError(message);
      console.error("Failed to delete diagram", error);
    }
  };

  return (
    <div className="workspace-page">
      <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Workspace
          </div>
          <div className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
            Diagrams
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_1px_3px_rgba(66,98,255,0.18)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus size={18} />
          New board
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-5">
          {actionError && (
            <div
              role="alert"
              className="rounded-md border px-4 py-3 text-sm font-medium"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 24%, var(--border))",
                background: "color-mix(in srgb, var(--danger) 10%, var(--surface-raised))",
                color: "var(--danger)",
              }}
            >
              {actionError}
            </div>
          )}

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="floating-panel rounded-lg px-6 py-6">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  <Layers3 size={14} className="text-[var(--accent)]" />
                  Canvas-first flow
                </div>
                <h1 className="mt-4 text-[clamp(2rem,3vw,3rem)] font-semibold tracking-[-0.05em] text-[var(--foreground)]">
                  Organize architecture work like a collaborative board, not a form.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)]">
                  Create boards, map systems visually, and keep Mermaid plus investigations beside the canvas instead of buried in separate tools.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Boards
                  </div>
                  <div className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                    {diagrams.length}
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Right panel
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    Mermaid + investigations
                  </div>
                </div>
                <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)]">
                    Shortcuts
                  </div>
                  <div className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    Save, layout, group, export
                  </div>
                </div>
              </div>
            </div>

            <div className="floating-panel rounded-lg px-5 py-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Quickstart
              </div>
              <div className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                Start a fresh board in three moves
              </div>
              <div className="mt-4 space-y-3">
                {[
                  "Create a board and name the system or incident you are mapping.",
                  "Drop shapes from the left rail directly onto the canvas.",
                  "Use the right dock to sync Mermaid text or attach an investigation.",
                ].map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">
                      {index + 1}
                    </div>
                    <div className="text-sm leading-6 text-[var(--text-muted)]">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {diagrams.length === 0 ? (
            <section className="floating-panel flex flex-col items-center rounded-lg px-8 py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Grid2x2Plus size={34} />
              </div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                No boards yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-7 text-[var(--text-muted)]">
                Create your first board to start working with the new canvas layout and docked documentation workflow.
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_1px_3px_rgba(66,98,255,0.18)] transition-colors hover:bg-[var(--accent-hover)]"
              >
                <Plus size={18} />
                Create board
              </button>
            </section>
          ) : (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {diagrams.map((diagram) => (
                <article
                  key={diagram.id}
                  className="group floating-panel cursor-pointer rounded-lg p-4 transition-transform duration-150 hover:-translate-y-0.5"
                  onClick={() => router.push(`/diagrams/${diagram.id}`)}
                >
                  <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="rounded border border-dashed border-[color:color-mix(in_srgb,var(--accent)_18%,var(--border))] bg-[linear-gradient(180deg,rgba(66,98,255,0.05),transparent_55%),var(--canvas-bg)] p-4">
                      <div className="grid gap-3">
                        <div className="flex gap-3">
                          <div className="h-14 flex-1 rounded border border-[var(--border)] bg-[var(--surface)]" />
                          <div className="h-14 w-20 rounded border border-[var(--border)] bg-[var(--surface)]" />
                        </div>
                        <div className="flex gap-3">
                          <div className="h-12 w-20 rounded border border-[var(--border)] bg-[var(--surface)]" />
                          <div className="h-12 flex-1 rounded border border-[var(--border)] bg-[var(--surface)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-2 pb-2 pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-semibold tracking-[-0.03em] text-[var(--foreground)]">
                          {diagram.name}
                        </h2>
                        <p className="mt-1 line-clamp-2 min-h-[42px] text-sm leading-6 text-[var(--text-muted)]">
                          {diagram.description || "Open the board to add Mermaid, investigations, and architecture notes."}
                        </p>
                      </div>

                      <button
                        type="button"
                        title="Delete board"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[color:color-mix(in_srgb,var(--danger)_10%,var(--surface))] hover:text-[var(--danger)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleDelete(diagram.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        Updated {formatUpdatedAt(diagram.updatedAt)}
                      </span>
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {diagram.nodeCount} nodes
                      </span>
                      <span className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {diagram.edgeCount} edges
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="edit-modal-overlay" onClick={() => setShowCreate(false)}>
          <div
            className="edit-modal"
            style={{ width: "520px", maxWidth: "92vw" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="edit-modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, letterSpacing: "-0.03em" }}>
                  Create a new board
                </h2>
                <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  Start with an empty canvas and add structure as you go.
                </p>
              </div>
              <button className="edit-modal-close" onClick={() => setShowCreate(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="edit-modal-body">
              <div className="edit-modal-field">
                <label className="edit-modal-label">Board name</label>
                <input
                  className="edit-modal-input"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="e.g. Payment service incident map"
                  autoFocus
                  onKeyDown={(event) => event.key === "Enter" && handleCreate()}
                />
              </div>

              <div className="edit-modal-field">
                <label className="edit-modal-label">Description</label>
                <input
                  className="edit-modal-input"
                  value={newDesc}
                  onChange={(event) => setNewDesc(event.target.value)}
                  placeholder="Optional context for the board"
                  onKeyDown={(event) => event.key === "Enter" && handleCreate()}
                />
              </div>
            </div>

            <div className="edit-modal-footer">
              <button className="edit-modal-btn edit-modal-btn-secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className="edit-modal-btn edit-modal-btn-primary"
                onClick={handleCreate}
                disabled={!newName.trim()}
              >
                Create board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
