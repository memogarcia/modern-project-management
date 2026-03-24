"use client";

import { useMemo, useState } from "react";
import { BookOpen, LifeBuoy, Shield, Sparkles } from "lucide-react";
import { useInvestigations } from "@/hooks/useInvestigations";
import type { ArchEdge, DiagramNode } from "@/lib/types";
import type { DiagramPerspective, DiagramPerspectiveKind } from "@/lib/diagramPerspectives";

interface PerspectivesPanelProps {
  diagramId: string;
  nodes: DiagramNode[];
  edges: ArchEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  perspectives: DiagramPerspective[];
  isLoading?: boolean;
  errorMessage?: string | null;
  activePerspectiveId: string | null;
  onApplyPerspective: (perspectiveId: string | null) => void;
  onCreateCustomPerspective: (title: string, description: string) => void;
  onUpdatePerspectiveFromSelection: (perspectiveId: string) => void;
  onUpsertSuggestedPerspective: (
    kind: Exclude<DiagramPerspectiveKind, "custom">,
    sessions: ReturnType<typeof useInvestigations>["data"]
  ) => void;
  onDeletePerspective: (perspectiveId: string) => void;
}

const PERSPECTIVE_META: Record<
  Exclude<DiagramPerspectiveKind, "custom">,
  { label: string; description: string; icon: typeof BookOpen }
> = {
  onboarding: {
    label: "Onboarding",
    description: "Strip the board down to the main architecture and request path.",
    icon: BookOpen,
  },
  operations: {
    label: "Operations",
    description: "Focus on owned components, incident scope, and operational entry points.",
    icon: LifeBuoy,
  },
  security: {
    label: "Security",
    description: "Highlight trust boundaries, auth assumptions, and exposed flows.",
    icon: Shield,
  },
};

function SavedPerspectiveCard(props: {
  perspective: DiagramPerspective;
  isActive: boolean;
  canUpdateFromSelection: boolean;
  onApply: () => void;
  onUpdateFromSelection: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-[var(--foreground)]">
              {props.perspective.title}
            </div>
            {props.isActive && (
              <span className="rounded-full border border-[color:color-mix(in_srgb,var(--accent)_32%,var(--border))] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                Active
              </span>
            )}
          </div>
          {props.perspective.description && (
            <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              {props.perspective.description}
            </div>
          )}
          <div className="mt-2 text-[11px] text-[var(--text-muted)]">
            {props.perspective.nodeIds.length} nodes · {props.perspective.edgeIds.length} edges
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="edit-modal-btn edit-modal-btn-primary"
          onClick={props.onApply}
        >
          {props.isActive ? "Reapply" : "Apply"}
        </button>
        <button
          type="button"
          className="edit-modal-btn edit-modal-btn-secondary"
          onClick={props.onUpdateFromSelection}
          disabled={!props.canUpdateFromSelection}
        >
          Update from selection
        </button>
        <button
          type="button"
          className="edit-modal-btn edit-modal-btn-secondary"
          onClick={props.onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function PerspectivesPanel(props: PerspectivesPanelProps) {
  const investigations = useInvestigations({ diagramId: props.diagramId });
  const [customTitle, setCustomTitle] = useState("");
  const [customDescription, setCustomDescription] = useState("");

  const selectionSummary = useMemo(() => {
    const nodeCount = props.selectedNodeIds.length;
    const edgeCount = props.selectedEdgeIds.length;
    if (nodeCount === 0 && edgeCount === 0) return "No nodes or edges selected";
    return `${nodeCount} nodes · ${edgeCount} edges selected`;
  }, [props.selectedEdgeIds.length, props.selectedNodeIds.length]);

  return (
    <div className="flex h-full flex-col bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Perspectives
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
          Save focused views for onboarding, operations, and security
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Perspectives are saved with this diagram so the same model can be reused across browsers and MCP clients.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {props.errorMessage && (
            <section className="rounded-[22px] border border-[color:color-mix(in_srgb,var(--warning)_32%,var(--border))] bg-[color:color-mix(in_srgb,var(--warning)_10%,var(--panel-bg))] p-4 text-sm text-[var(--foreground)]">
              {props.errorMessage}
            </section>
          )}

          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Active view
                </div>
                <div className="mt-1 text-sm text-[var(--foreground)]">
                  {props.activePerspectiveId
                    ? props.perspectives.find((perspective) => perspective.id === props.activePerspectiveId)?.title ?? "Saved perspective"
                    : "Full diagram"}
                </div>
              </div>
              <button
                type="button"
                className="edit-modal-btn edit-modal-btn-secondary"
                onClick={() => props.onApplyPerspective(null)}
                disabled={!props.activePerspectiveId}
              >
                Clear
              </button>
            </div>
          </section>

          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Suggested views
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Use these to split overloaded diagrams into audience-specific views without duplicating the underlying model.
              </div>
            </div>

            <div className="space-y-3">
              {(Object.keys(PERSPECTIVE_META) as Array<Exclude<DiagramPerspectiveKind, "custom">>).map((kind) => {
                const meta = PERSPECTIVE_META[kind];
                const Icon = meta.icon;

                return (
                  <div key={kind} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                          <Icon size={15} className="text-[var(--accent)]" />
                          {meta.label}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                          {meta.description}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="edit-modal-btn edit-modal-btn-primary"
                        onClick={() => props.onUpsertSuggestedPerspective(kind, investigations.data)}
                      >
                        Save + apply
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Save current selection
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                {selectionSummary}
              </div>
            </div>

            <input
              className="edit-modal-input"
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="Perspective title"
            />
            <textarea
              className="edit-modal-input"
              rows={3}
              value={customDescription}
              onChange={(event) => setCustomDescription(event.target.value)}
              placeholder="What this view is for"
            />
            <button
              type="button"
              className="edit-modal-btn edit-modal-btn-primary"
              disabled={!customTitle.trim() || (props.selectedNodeIds.length === 0 && props.selectedEdgeIds.length === 0)}
              onClick={() => {
                props.onCreateCustomPerspective(customTitle.trim(), customDescription.trim());
                setCustomTitle("");
                setCustomDescription("");
              }}
            >
              <Sparkles size={14} />
              Save perspective
            </button>
          </section>

          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Saved
              </div>
              <div className="mt-1 text-xs text-[var(--text-muted)]">
                Reuse the same board as multiple deliberate views instead of a single overloaded master diagram.
              </div>
            </div>

            {props.isLoading ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--text-muted)]">
                Loading saved perspectives...
              </div>
            ) : props.perspectives.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-4 text-sm text-[var(--text-muted)]">
                No perspectives saved yet.
              </div>
            ) : (
              <div className="space-y-3">
                {props.perspectives.map((perspective) => (
                  <SavedPerspectiveCard
                    key={perspective.id}
                    perspective={perspective}
                    isActive={props.activePerspectiveId === perspective.id}
                    canUpdateFromSelection={props.selectedNodeIds.length > 0 || props.selectedEdgeIds.length > 0}
                    onApply={() => props.onApplyPerspective(perspective.id)}
                    onUpdateFromSelection={() => props.onUpdatePerspectiveFromSelection(perspective.id)}
                    onDelete={() => props.onDeletePerspective(perspective.id)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
