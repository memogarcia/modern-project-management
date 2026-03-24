"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptyEdgeMetadata, type DiagramLinkReference } from "@planview/domain";
import type { ArchEdge } from "@/lib/types";

interface EdgeEditModalProps {
  edge: ArchEdge;
  onSave: (edgeId: string, updates: Partial<ArchEdge>) => void;
  onClose: () => void;
}

const EDGE_TYPES: { value: string; label: string }[] = [
  { value: "smoothstep", label: "Smooth step" },
  { value: "default", label: "Bezier" },
  { value: "straight", label: "Straight" },
  { value: "step", label: "Step" },
];

const RELATIONSHIP_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Calls", value: "calls" },
  { label: "Reads from", value: "reads from" },
  { label: "Writes to", value: "writes to" },
  { label: "Publishes to", value: "publishes to" },
  { label: "Consumes from", value: "consumes from" },
  { label: "Replicates to", value: "replicates to" },
];

function normalizeLinks(links: DiagramLinkReference[]): DiagramLinkReference[] {
  return links
    .map((entry) => ({
      id: entry.id.trim() || crypto.randomUUID(),
      label: entry.label.trim(),
      url: entry.url.trim(),
      kind: entry.kind,
    }))
    .filter((entry) => entry.label && entry.url);
}

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function EvidenceSection(props: {
  links: DiagramLinkReference[];
  onChange: (links: DiagramLinkReference[]) => void;
}) {
  return (
    <section className="edit-modal-field">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="edit-modal-label">Evidence references</label>
          <div className="text-[11px] text-[var(--text-muted)]">Links to logs, dashboards, traces, or tickets that support this dependency.</div>
        </div>
        <button
          className="edit-modal-btn edit-modal-btn-secondary"
          type="button"
          onClick={() =>
            props.onChange([
              ...props.links,
              { id: crypto.randomUUID(), label: "", url: "", kind: "other" },
            ])
          }
        >
          Add link
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {props.links.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            No evidence references added yet.
          </div>
        )}
        {props.links.map((link, index) => (
          <div key={link.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
            <input
              className="edit-modal-input"
              value={link.label}
              onChange={(event) => {
                const next = [...props.links];
                next[index] = { ...link, label: event.target.value };
                props.onChange(next);
              }}
              placeholder="Reference label"
            />
            <input
              className="edit-modal-input"
              value={link.url}
              onChange={(event) => {
                const next = [...props.links];
                next[index] = { ...link, url: event.target.value };
                props.onChange(next);
              }}
              placeholder="https://..."
            />
            <div className="flex justify-end">
              <button
                className="edit-modal-btn edit-modal-btn-secondary"
                type="button"
                onClick={() => props.onChange(props.links.filter((entry) => entry.id !== link.id))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function EdgeEditModal({ edge, onSave, onClose }: EdgeEditModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const initialMetadata = useMemo(
    () => edge.data?.metadata ?? createEmptyEdgeMetadata(new Date().toISOString()),
    [edge.data?.metadata]
  );

  const [label, setLabel] = useState((edge.data?.label ?? edge.label ?? "") as string);
  const [edgeType, setEdgeType] = useState(edge.type ?? "smoothstep");
  const [animated, setAnimated] = useState(edge.animated ?? false);
  const [relationshipType, setRelationshipType] = useState(initialMetadata.relationshipType);
  const [protocol, setProtocol] = useState(initialMetadata.protocol || edge.data?.protocol || "");
  const [authAssumptions, setAuthAssumptions] = useState(initialMetadata.authAssumptions);
  const [dependencyNotes, setDependencyNotes] = useState(initialMetadata.dependencyNotes);
  const [knownFailureModesText, setKnownFailureModesText] = useState(initialMetadata.knownFailureModes.join("\n"));
  const [notesMarkdown, setNotesMarkdown] = useState(initialMetadata.notesMarkdown);
  const [commentsMarkdown, setCommentsMarkdown] = useState(initialMetadata.commentsMarkdown);
  const [evidenceReferences, setEvidenceReferences] = useState(initialMetadata.evidenceReferences);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = useCallback(() => {
    const normalizedRelationshipType = relationshipType.trim();
    const normalizedProtocol = protocol.trim();
    const finalLabel = label.trim() || normalizedRelationshipType || undefined;
    const { renderWarningLabel: _renderWarningLabel, renderWarningTone: _renderWarningTone, ...baseEdgeData } =
      edge.data ?? {};

    const metadata = {
      ...initialMetadata,
      relationshipType: normalizedRelationshipType,
      protocol: normalizedProtocol,
      authAssumptions,
      dependencyNotes,
      knownFailureModes: splitLines(knownFailureModesText),
      notesMarkdown,
      commentsMarkdown,
      evidenceReferences: normalizeLinks(evidenceReferences),
      updatedAt: new Date().toISOString(),
    };

    onSave(edge.id, {
      label: finalLabel,
      type: edgeType,
      animated,
      data: {
        ...baseEdgeData,
        label: finalLabel,
        protocol: normalizedProtocol || undefined,
        metadata,
      },
    });
    onClose();
  }, [
    animated,
    authAssumptions,
    commentsMarkdown,
    dependencyNotes,
    edge.data,
    edge.id,
    edgeType,
    evidenceReferences,
    initialMetadata,
    knownFailureModesText,
    label,
    notesMarkdown,
    onClose,
    onSave,
    protocol,
    relationshipType,
  ]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  return (
    <div ref={overlayRef} className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div className="edit-modal" style={{ maxWidth: 760, width: "min(88vw, 760px)" }}>
        <div className="edit-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Edit dependency</span>
          </div>
          <button className="edit-modal-close" onClick={onClose}>x</button>
        </div>

        <div className="edit-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Label</label>
              <input
                className="edit-modal-input"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Visible edge label, usually a short verb"
                autoFocus
              />
              <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                This is what readers see on the canvas. Prefer short verbs over generic arrows.
              </div>
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Relationship type</label>
              <input className="edit-modal-input" value={relationshipType} onChange={(event) => setRelationshipType(event.target.value)} placeholder="sync call, queue subscription, replication" />
              <div className="mt-2 flex flex-wrap gap-2">
                {RELATIONSHIP_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="edit-modal-btn edit-modal-btn-secondary"
                    onClick={() => {
                      setRelationshipType(preset.value);
                      setLabel((current) => current.trim() || preset.value);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Protocol</label>
              <input className="edit-modal-input" value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="HTTP, gRPC, Kafka, SQL" />
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Edge style</label>
              <div className="flex gap-2 flex-wrap">
                {EDGE_TYPES.map((typeOption) => (
                  <button
                    key={typeOption.value}
                    type="button"
                    className="edit-modal-btn"
                    style={{
                      background: edgeType === typeOption.value ? "var(--accent)" : "var(--surface)",
                      color: edgeType === typeOption.value ? "var(--accent-foreground)" : "var(--foreground)",
                      border: `1px solid ${edgeType === typeOption.value ? "var(--accent)" : "var(--border)"}`,
                    }}
                    onClick={() => setEdgeType(typeOption.value)}
                  >
                    {typeOption.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Auth assumptions</label>
            <textarea className="edit-modal-input" rows={3} value={authAssumptions} onChange={(event) => setAuthAssumptions(event.target.value)} placeholder="mTLS, JWT claims, shared IAM role assumptions, or network trust boundaries" />
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Dependency notes</label>
            <textarea className="edit-modal-input" rows={4} value={dependencyNotes} onChange={(event) => setDependencyNotes(event.target.value)} placeholder="Latency sensitivity, retries, timeout behavior, or sequencing constraints" />
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Known failure modes</label>
            <textarea className="edit-modal-input" rows={4} value={knownFailureModesText} onChange={(event) => setKnownFailureModesText(event.target.value)} placeholder="One failure mode per line" />
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Notes</label>
            <textarea className="edit-modal-input" rows={6} value={notesMarkdown} onChange={(event) => setNotesMarkdown(event.target.value)} placeholder="Markdown notes for this dependency edge." />
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Comments</label>
            <textarea className="edit-modal-input" rows={5} value={commentsMarkdown} onChange={(event) => setCommentsMarkdown(event.target.value)} placeholder="Operational commentary, caveats, and human context." />
          </section>

          <EvidenceSection links={evidenceReferences} onChange={setEvidenceReferences} />

          <section className="edit-modal-field">
            <label className="edit-modal-label">Animation</label>
            <label className="edit-modal-toggle">
              <input type="checkbox" checked={animated} onChange={(event) => setAnimated(event.target.checked)} />
              <span className="edit-modal-toggle-slider" />
              <span style={{ marginLeft: 8, fontSize: 13 }}>Animated edge</span>
            </label>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Timestamps</label>
            <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)] md:grid-cols-2">
              <div>Created: {new Date(initialMetadata.createdAt).toLocaleString()}</div>
              <div>Updated: {new Date(initialMetadata.updatedAt).toLocaleString()}</div>
            </div>
          </section>
        </div>

        <div className="edit-modal-footer">
          <button className="edit-modal-btn edit-modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="edit-modal-btn edit-modal-btn-primary" onClick={handleSave}>Save changes</button>
        </div>
      </div>
    </div>
  );
}
