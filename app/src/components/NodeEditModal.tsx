"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createEmptyNodeMetadata,
  type ArtifactReference,
  type DiagramLinkReference,
} from "@planview/domain";
import type { ArchNode } from "@/lib/types";
import { getContrastTextColor, getShapeDef, SHAPE_REGISTRY, type ShapeType } from "@/lib/types";
import { uploadArtifact } from "@/lib/investigationStorage";
import ShapeIcon from "@/components/ShapeIcon";
import { useTheme } from "@/components/ThemeProvider";

interface NodeEditModalProps {
  diagramId: string;
  node: ArchNode;
  onSave: (nodeId: string, data: Partial<ArchNode["data"]>) => void;
  onClose: () => void;
}

const PRESET_COLORS_LIGHT = [
  "#e3f2fd", "#e8f5e9", "#fff8e1", "#f3e5f5", "#ffebee",
  "#e0f7fa", "#f9fbe7", "#e8eaf6", "#e1f5fe", "#f5f5f5",
];

const PRESET_COLORS_DARK = [
  "#1e3a5f", "#1b3a26", "#4a2f10", "#3b1f4a", "#3b1414",
  "#0f3038", "#2a3510", "#1a1f3f", "#0c2f4a", "#2a2a2a",
];

const PRESET_BORDER_COLORS = [
  "#2196f3", "#4caf50", "#9c27b0", "#ff9800", "#00bcd4",
  "#607d8b", "#f44336", "#cddc39", "#3f51b5", "#03a9f4",
];

function splitMultilineList(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeLinks(value: DiagramLinkReference[]): DiagramLinkReference[] {
  return value
    .map((entry) => ({
      id: entry.id.trim() || crypto.randomUUID(),
      label: entry.label.trim(),
      url: entry.url.trim(),
      kind: entry.kind,
    }))
    .filter((entry) => entry.label && entry.url);
}

function LinkSection(props: {
  title: string;
  description: string;
  links: DiagramLinkReference[];
  onChange: (links: DiagramLinkReference[]) => void;
  kind: DiagramLinkReference["kind"];
}) {
  const addLink = () => {
    props.onChange([
      ...props.links,
      {
        id: crypto.randomUUID(),
        label: "",
        url: "",
        kind: props.kind,
      },
    ]);
  };

  return (
    <section className="edit-modal-field">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label className="edit-modal-label">{props.title}</label>
          <div className="text-[11px] text-[var(--text-muted)]">{props.description}</div>
        </div>
        <button className="edit-modal-btn edit-modal-btn-secondary" type="button" onClick={addLink}>
          Add link
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {props.links.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            No links added yet.
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
              placeholder="Link label"
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

export default function NodeEditModal({ diagramId, node, onSave, onClose }: NodeEditModalProps) {
  const { theme } = useTheme();
  const overlayRef = useRef<HTMLDivElement>(null);
  const initialMetadata = useMemo(
    () =>
      node.data.metadata ??
      createEmptyNodeMetadata(
        node.data.label,
        new Date().toISOString(),
        node.data.description ?? ""
      ),
    [node.data.description, node.data.label, node.data.metadata]
  );

  const shape = getShapeDef(node.data.shapeType);
  const presetColors = theme === "dark" ? PRESET_COLORS_DARK : PRESET_COLORS_LIGHT;
  const defaultBg = theme === "dark" ? shape.darkColor : shape.color;

  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(initialMetadata.description || node.data.description || "");
  const [owner, setOwner] = useState(initialMetadata.owner);
  const [tagText, setTagText] = useState(initialMetadata.tags.join(", "));
  const [notesMarkdown, setNotesMarkdown] = useState(initialMetadata.notesMarkdown);
  const [failureModesText, setFailureModesText] = useState(initialMetadata.knownFailureModes.join("\n"));
  const [lastVerifiedAt, setLastVerifiedAt] = useState(
    initialMetadata.lastVerifiedAt ? initialMetadata.lastVerifiedAt.slice(0, 10) : ""
  );
  const [documentationLinks, setDocumentationLinks] = useState(initialMetadata.documentationLinks);
  const [dashboardLinks, setDashboardLinks] = useState(initialMetadata.dashboardLinks);
  const [logLinks, setLogLinks] = useState(initialMetadata.logLinks);
  const [traceLinks, setTraceLinks] = useState(initialMetadata.traceLinks);
  const [runbookLinks, setRunbookLinks] = useState(initialMetadata.runbookLinks);
  const [attachments, setAttachments] = useState<ArtifactReference[]>(initialMetadata.attachments);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [bgColor, setBgColor] = useState(node.data.color ?? defaultBg);
  const [borderColor, setBorderColor] = useState(node.data.borderColor ?? shape.borderColor);
  const [animated, setAnimated] = useState(node.data.animated ?? false);
  const [shapeType, setShapeType] = useState<ShapeType>(node.data.shapeType);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setUploadError(null);
      try {
        const artifact = await uploadArtifact({
          ownerType: "node",
          diagramId,
          ownerId: node.id,
          label: file.name,
          file,
        });
        setAttachments((current) => [...current, artifact]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Upload failed");
      } finally {
        setIsUploading(false);
        event.target.value = "";
      }
    },
    [diagramId, node.id]
  );

  const handleSave = useCallback(() => {
    const now = new Date().toISOString();
    const metadata = {
      ...initialMetadata,
      title: label.trim() || node.data.label,
      description: description.trim(),
      owner: owner.trim(),
      tags: splitCommaList(tagText),
      documentationLinks: normalizeLinks(documentationLinks),
      dashboardLinks: normalizeLinks(dashboardLinks),
      logLinks: normalizeLinks(logLinks),
      traceLinks: normalizeLinks(traceLinks),
      runbookLinks: normalizeLinks(runbookLinks),
      knownFailureModes: splitMultilineList(failureModesText),
      notesMarkdown,
      attachments,
      updatedAt: now,
      lastVerifiedAt: lastVerifiedAt ? new Date(`${lastVerifiedAt}T00:00:00.000Z`).toISOString() : undefined,
    };

    onSave(node.id, {
      label: metadata.title,
      description: metadata.description,
      color: bgColor,
      borderColor,
      animated,
      shapeType,
      metadata,
    });
    onClose();
  }, [
    animated,
    attachments,
    bgColor,
    borderColor,
    dashboardLinks,
    description,
    documentationLinks,
    failureModesText,
    initialMetadata,
    label,
    lastVerifiedAt,
    logLinks,
    node.data.label,
    node.id,
    notesMarkdown,
    onClose,
    onSave,
    owner,
    runbookLinks,
    shapeType,
    tagText,
    traceLinks,
  ]);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  return (
    <div ref={overlayRef} className="edit-modal-overlay" onClick={handleOverlayClick}>
      <div className="edit-modal" style={{ maxWidth: 860, width: "min(90vw, 860px)" }}>
        <div className="edit-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShapeIcon type={shapeType} size={18} color={borderColor} strokeWidth={1.5} />
            <span>Component details</span>
          </div>
          <button className="edit-modal-close" onClick={onClose}>x</button>
        </div>

        <div className="edit-modal-body" style={{ maxHeight: "72vh", overflowY: "auto" }}>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Title</label>
              <input className="edit-modal-input" value={label} onChange={(event) => setLabel(event.target.value)} autoFocus />
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Owner</label>
              <input className="edit-modal-input" value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Team or engineer" />
            </div>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Description</label>
            <textarea className="edit-modal-input" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Tags</label>
              <input className="edit-modal-input" value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="api, auth, production" />
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Last verified</label>
              <input className="edit-modal-input" type="date" value={lastVerifiedAt} onChange={(event) => setLastVerifiedAt(event.target.value)} />
            </div>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Known failure modes</label>
            <textarea
              className="edit-modal-input"
              rows={4}
              value={failureModesText}
              onChange={(event) => setFailureModesText(event.target.value)}
              placeholder="One failure mode per line"
            />
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Operational notes</label>
            <textarea
              className="edit-modal-input"
              rows={8}
              value={notesMarkdown}
              onChange={(event) => setNotesMarkdown(event.target.value)}
              placeholder="Markdown notes, escalation context, caveats, and recovery hints."
            />
          </section>

          <LinkSection title="Documentation" description="Design docs, ADRs, and architecture references." links={documentationLinks} onChange={setDocumentationLinks} kind="documentation" />
          <LinkSection title="Dashboards" description="Dashboards and metrics pages for this component." links={dashboardLinks} onChange={setDashboardLinks} kind="dashboard" />
          <LinkSection title="Logs" description="Log views and operational log entry points." links={logLinks} onChange={setLogLinks} kind="logs" />
          <LinkSection title="Traces" description="Distributed trace entry points and profilers." links={traceLinks} onChange={setTraceLinks} kind="trace" />
          <LinkSection title="Runbooks" description="Runbooks and recovery procedures." links={runbookLinks} onChange={setRunbookLinks} kind="runbook" />

          <section className="edit-modal-field">
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="edit-modal-label">Attachments</label>
                <div className="text-[11px] text-[var(--text-muted)]">Stored on disk with checksums and metadata.</div>
              </div>
              <label className="edit-modal-btn edit-modal-btn-secondary cursor-pointer">
                {isUploading ? "Uploading..." : "Upload"}
                <input hidden type="file" onChange={handleUpload} />
              </label>
            </div>
            {uploadError && <div className="mt-2 text-xs text-[var(--danger)]">{uploadError}</div>}
            <div className="mt-2 space-y-2">
              {attachments.length === 0 && (
                <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
                  No attachments uploaded yet.
                </div>
              )}
              {attachments.map((artifact) => (
                <div key={artifact.id} className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                  <div className="font-medium text-[var(--foreground)]">{artifact.label}</div>
                  <div className="text-[var(--text-muted)]">
                    {artifact.fileName} · {artifact.mimeType} · {Math.max(1, Math.round(artifact.sizeBytes / 1024))} KB
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Shape</label>
              <select
                className="edit-modal-input"
                value={shapeType}
                onChange={(event) => {
                  const nextShape = event.target.value as ShapeType;
                  const definition = getShapeDef(nextShape);
                  setShapeType(nextShape);
                  setBgColor(theme === "dark" ? definition.darkColor : definition.color);
                  setBorderColor(definition.borderColor);
                }}
              >
                {Object.entries(SHAPE_REGISTRY).map(([key, definition]) => (
                  <option key={key} value={key}>
                    {definition.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Animation</label>
              <label className="edit-modal-toggle">
                <input type="checkbox" checked={animated} onChange={(event) => setAnimated(event.target.checked)} />
                <span className="edit-modal-toggle-slider" />
                <span style={{ marginLeft: 8, fontSize: 13 }}>Pulse glow animation</span>
              </label>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="edit-modal-field">
              <label className="edit-modal-label">Background color</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="color" value={bgColor} onChange={(event) => setBgColor(event.target.value)} style={{ width: 36, height: 36, border: "none", borderRadius: 6, padding: 0 }} />
                {presetColors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="edit-modal-color-swatch"
                    style={{
                      background: color,
                      outline: bgColor === color ? "2px solid var(--accent)" : "1px solid var(--border)",
                      outlineOffset: 1,
                    }}
                    onClick={() => setBgColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="edit-modal-field">
              <label className="edit-modal-label">Border color</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <input type="color" value={borderColor} onChange={(event) => setBorderColor(event.target.value)} style={{ width: 36, height: 36, border: "none", borderRadius: 6, padding: 0 }} />
                {PRESET_BORDER_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="edit-modal-color-swatch"
                    style={{
                      background: color,
                      outline: borderColor === color ? "2px solid var(--accent)" : "1px solid var(--border)",
                      outlineOffset: 1,
                    }}
                    onClick={() => setBorderColor(color)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Timestamps</label>
            <div className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-muted)] md:grid-cols-2">
              <div>Created: {new Date(initialMetadata.createdAt).toLocaleString()}</div>
              <div>Updated: {new Date(initialMetadata.updatedAt).toLocaleString()}</div>
            </div>
          </section>

          <section className="edit-modal-field">
            <label className="edit-modal-label">Preview</label>
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
              <div
                className={animated ? "node-pulse-animation" : ""}
                style={{
                  background: bgColor,
                  border: `2px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: "14px 20px",
                  minWidth: 180,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <ShapeIcon type={shapeType} size={20} color={getContrastTextColor(bgColor)} strokeWidth={1.5} />
                <div style={{ color: getContrastTextColor(bgColor), fontWeight: 700, textAlign: "center" }}>
                  {label || "Untitled component"}
                </div>
                {owner && <div style={{ color: getContrastTextColor(bgColor), fontSize: 12 }}>{owner}</div>}
              </div>
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
