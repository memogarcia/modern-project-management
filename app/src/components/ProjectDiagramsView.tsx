"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { KanbanProject } from "@/lib/projectTypes";
import type { DiagramMeta } from "@/lib/types";
import { loadDiagrams } from "@/lib/storage";
import { useProjectStore } from "@/store/projectStore";
import { Share2, FileText, ArrowRight, Plus, Link2Off, Link2 } from "lucide-react";

export default function ProjectDiagramsView({ project }: { project: KanbanProject }) {
  const router = useRouter();
  const linkDiagram = useProjectStore((s) => s.linkDiagram);
  const unlinkDiagram = useProjectStore((s) => s.unlinkDiagram);

  const [allDiagrams, setAllDiagrams] = useState<DiagramMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  useEffect(() => {
    loadDiagrams().then((diagrams) => {
      setAllDiagrams(diagrams);
      setLoading(false);
    });
  }, []);

  const linkedDiagrams = allDiagrams.filter((d) => project.diagramIds?.includes(d.id));
  const unlinkedDiagrams = allDiagrams.filter((d) => !project.diagramIds?.includes(d.id));

  if (loading) {
    return <div className="p-8 text-center text-[var(--text-muted)]">Loading diagrams...</div>;
  }

  return (
    <div className="flex h-full flex-col p-8 overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Share2 className="h-5 w-5 text-[#ec4899]" />
            Linked Diagrams
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Architecture and technical diagrams associated with this project.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLinkPicker(!showLinkPicker)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90 transition-opacity"
          >
            <Link2 className="h-4 w-4" />
            Link Diagram
          </button>
          <button
            onClick={() => router.push("/diagrams")}
            className="flex items-center gap-2 rounded-lg bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-hover)]"
          >
            View all diagrams
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Link picker dropdown */}
      {showLinkPicker && (
        <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] p-4 shadow-lg">
          <div className="mb-3 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">
            Available diagrams to link
          </div>
          {unlinkedDiagrams.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--text-muted)]">
              {allDiagrams.length === 0
                ? "No diagrams exist yet. Create one from the Diagrams page."
                : "All diagrams are already linked to this project."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
              {unlinkedDiagrams.map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    linkDiagram(d.id);
                    if (unlinkedDiagrams.length === 1) setShowLinkPicker(false);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] group"
                >
                  <Plus className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--accent)] shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <div className="truncate text-sm font-medium text-[var(--foreground)]">{d.name}</div>
                    {d.description && (
                      <div className="truncate text-xs text-[var(--text-muted)]">{d.description}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {linkedDiagrams.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50">
          <FileText className="h-12 w-12 text-[var(--text-muted)] opacity-50 mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">No linked diagrams</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-md mb-4">
            Link existing architecture diagrams to this project, or create new ones from the Diagrams page.
          </p>
          <button
            onClick={() => setShowLinkPicker(true)}
            className="flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)] hover:opacity-90"
          >
            <Link2 className="h-4 w-4" />
            Link a Diagram
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {linkedDiagrams.map((d) => (
            <div
              key={d.id}
              className="flex flex-col text-left p-5 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] hover:border-[#ec4899] hover:shadow-[0_4px_12px_rgba(236,72,153,0.1)] transition-all group"
            >
              <button
                onClick={() => router.push(`/diagrams/${d.id}`)}
                className="flex-1 text-left"
              >
                <h3 className="font-semibold text-[var(--foreground)] mb-2 group-hover:text-[#ec4899] transition-colors">{d.name}</h3>
                {d.description && (
                  <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-4">{d.description}</p>
                )}
              </button>
              <div className="mt-auto pt-4 flex items-center justify-between text-xs text-[var(--text-subtle)] border-t border-[var(--border)]">
                <span>Updated {new Date(d.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={() => unlinkDiagram(d.id)}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[var(--text-muted)] hover:bg-[#ef444418] hover:text-[#ef4444] transition-colors"
                  title="Unlink from project"
                >
                  <Link2Off className="h-3 w-3" />
                  Unlink
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
