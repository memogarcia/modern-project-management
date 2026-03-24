"use client";

import { useMemo } from "react";
import { AlertTriangle, ArrowUpRight, CheckCircle2, FileCheck, LifeBuoy, Link2, ShieldCheck } from "lucide-react";
import type { ArchEdge, ArchNode, DiagramNode } from "@/lib/types";
import {
  analyzeDiagramQuality,
  collectEdgeQuickLinks,
  collectNodeQuickLinks,
  type DiagramQualityEntityRef,
} from "@/lib/diagramQuality";

interface QualityPanelProps {
  nodes: DiagramNode[];
  edges: ArchEdge[];
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  onFocusEntity?: (entity: DiagramQualityEntityRef) => void;
}

function formatDate(value: string | undefined): string {
  if (!value) return "Not verified";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Invalid date";
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
}) {
  const toneStyles =
    props.tone === "warning"
      ? {
          borderColor: "color-mix(in srgb, var(--warning) 34%, var(--border))",
          background: "color-mix(in srgb, var(--warning) 10%, var(--surface))",
          valueColor: "var(--foreground)",
        }
      : props.tone === "success"
        ? {
            borderColor: "color-mix(in srgb, var(--success) 28%, var(--border))",
            background: "color-mix(in srgb, var(--success) 8%, var(--surface))",
            valueColor: "var(--foreground)",
          }
        : {
            borderColor: "var(--border)",
            background: "var(--surface)",
            valueColor: "var(--foreground)",
          };

  return (
    <div
      className="rounded-2xl border px-3 py-3"
      style={{ borderColor: toneStyles.borderColor, background: toneStyles.background }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {props.label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-[-0.03em]" style={{ color: toneStyles.valueColor }}>
        {props.value}
      </div>
    </div>
  );
}

function QuickLinksSection(props: {
  title: string;
  emptyLabel: string;
  links: Array<{ id: string; label: string; url: string; groupLabel: string }>;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
          {props.title}
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          Open the resources that make this board operational, not just descriptive.
        </div>
      </div>

      {props.links.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--text-muted)]">
          {props.emptyLabel}
        </div>
      ) : (
        <div className="space-y-2">
          {props.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-2 text-sm text-[var(--foreground)] no-underline transition-colors hover:bg-[var(--surface-hover)]"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{link.label}</div>
                <div className="truncate text-[11px] text-[var(--text-muted)]">{link.groupLabel}</div>
              </div>
              <ArrowUpRight size={15} className="shrink-0 text-[var(--text-muted)]" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

export default function QualityPanel({
  nodes,
  edges,
  selectedNodeIds,
  selectedEdgeIds,
  onFocusEntity,
}: QualityPanelProps) {
  const quality = useMemo(() => analyzeDiagramQuality(nodes, edges), [nodes, edges]);

  const selectedArchNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null;
    return nodes.find((node): node is ArchNode => node.id === selectedNodeIds[0] && node.type === "archNode") ?? null;
  }, [nodes, selectedNodeIds]);

  const selectedEdge = useMemo(() => {
    if (selectedEdgeIds.length !== 1) return null;
    return edges.find((edge) => edge.id === selectedEdgeIds[0]) ?? null;
  }, [edges, selectedEdgeIds]);

  const selectedNodeLinks = useMemo(
    () => (selectedArchNode ? collectNodeQuickLinks(selectedArchNode) : []),
    [selectedArchNode]
  );
  const selectedEdgeLinks = useMemo(
    () => (selectedEdge ? collectEdgeQuickLinks(selectedEdge) : []),
    [selectedEdge]
  );

  const selectedNodeMetadata = selectedArchNode?.data.metadata;
  const selectedEdgeMetadata = selectedEdge?.data?.metadata;

  return (
    <div className="flex h-full flex-col bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
          Quality
        </div>
        <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
          Keep this board readable, current, and operational
        </div>
        <div className="mt-1 text-xs text-[var(--text-muted)]">
          These checks are derived from the data you already store on components, dependencies, and investigations.
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Diagram health
                </div>
                <div className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                  {quality.score}
                  <span className="ml-1 text-base font-medium text-[var(--text-muted)]">/ 100</span>
                </div>
              </div>

              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor:
                    quality.warningCount > 0
                      ? "color-mix(in srgb, var(--warning) 34%, var(--border))"
                      : "color-mix(in srgb, var(--success) 30%, var(--border))",
                  background:
                    quality.warningCount > 0
                      ? "color-mix(in srgb, var(--warning) 10%, var(--surface))"
                      : "color-mix(in srgb, var(--success) 10%, var(--surface))",
                  color: quality.warningCount > 0 ? "var(--foreground)" : "var(--foreground)",
                }}
              >
                {quality.warningCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {quality.warningCount > 0 ? `${quality.warningCount} warnings` : "Healthy baseline"}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Issues" value={quality.issues.length} tone={quality.warningCount > 0 ? "warning" : "success"} />
              <SummaryCard label="Stale Nodes" value={quality.staleNodeCount} tone={quality.staleNodeCount > 0 ? "warning" : "default"} />
              <SummaryCard label="Unclear Edges" value={quality.unlabeledEdgeCount} tone={quality.unlabeledEdgeCount > 0 ? "warning" : "default"} />
              <SummaryCard label="No Owner" value={quality.missingOwnerCount} tone={quality.missingOwnerCount > 0 ? "warning" : "default"} />
            </div>
          </section>

          {selectedArchNode && (
            <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    Selected component
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                    {selectedArchNode.data.label}
                  </div>
                </div>
                <div className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  {selectedArchNode.data.shapeType}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <ShieldCheck size={13} />
                    Ownership
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedNodeMetadata?.owner || "No owner recorded"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <FileCheck size={13} />
                    Last Verified
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {formatDate(selectedNodeMetadata?.lastVerifiedAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 sm:col-span-2">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <LifeBuoy size={13} />
                    Failure Modes
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedNodeMetadata?.knownFailureModes.length
                      ? `${selectedNodeMetadata.knownFailureModes.length} known failure modes recorded`
                      : "No failure modes recorded yet"}
                  </div>
                </div>
              </div>

              <QuickLinksSection
                title="Component links"
                emptyLabel="No linked docs, dashboards, logs, traces, or runbooks yet."
                links={selectedNodeLinks}
              />
            </section>
          )}

          {selectedEdge && (
            <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Selected dependency
                </div>
                <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {selectedEdge.data?.label || selectedEdge.label || `${selectedEdge.source} -> ${selectedEdge.target}`}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <Link2 size={13} />
                    Relationship
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedEdgeMetadata?.relationshipType || "No relationship type recorded"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                    <ShieldCheck size={13} />
                    Protocol / Auth
                  </div>
                  <div className="mt-2 text-sm text-[var(--foreground)]">
                    {selectedEdgeMetadata?.protocol || selectedEdge.data?.protocol || "No protocol recorded"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    {selectedEdgeMetadata?.authAssumptions || "No auth assumptions recorded"}
                  </div>
                </div>
              </div>

              <QuickLinksSection
                title="Evidence links"
                emptyLabel="No evidence links attached to this dependency yet."
                links={selectedEdgeLinks}
              />
            </section>
          )}

          <section className="space-y-3 rounded-[22px] border border-[var(--border)] bg-[var(--panel-bg)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Issues
                </div>
                <div className="mt-1 text-xs text-[var(--text-muted)]">
                  Fix the warning-level issues first. They usually map to missing clarity or stale trust signals. Use the Perspectives tab when the warning is really about scope.
                </div>
              </div>
            </div>

            {quality.issues.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:color-mix(in_srgb,var(--success)_40%,var(--border))] bg-[color:color-mix(in_srgb,var(--success)_10%,var(--surface))] px-4 py-4 text-sm text-[var(--foreground)]">
                This board has a solid baseline. Keep owners, verification dates, and dependency semantics up to date as the system changes.
              </div>
            ) : (
              <div className="space-y-2">
                {quality.issues.map((issue) => {
                  const isWarning = issue.severity === "warning";
                  const issueContent = (
                    <>
                      <div className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{
                            background: isWarning
                              ? "color-mix(in srgb, var(--warning) 18%, var(--surface))"
                              : "color-mix(in srgb, var(--accent) 12%, var(--surface))",
                            color: isWarning ? "var(--foreground)" : "var(--accent)",
                          }}
                        >
                          {isWarning ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-[var(--foreground)]">{issue.title}</div>
                            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                              {issue.category}
                            </span>
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{issue.description}</div>
                          {issue.entity && (
                            <div className="mt-2 text-[11px] font-medium text-[var(--text-muted)]">
                              {issue.entity.type === "node" ? "Component" : "Dependency"}: {issue.entity.label}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );

                  if (!issue.entity || !onFocusEntity) {
                    return (
                      <div
                        key={issue.id}
                        className="rounded-2xl border px-3 py-3"
                        style={{
                          borderColor: isWarning
                            ? "color-mix(in srgb, var(--warning) 28%, var(--border))"
                            : "var(--border)",
                          background: "var(--surface)",
                        }}
                      >
                        {issueContent}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={issue.id}
                      type="button"
                      onClick={() => onFocusEntity(issue.entity!)}
                      className="block w-full rounded-2xl border px-3 py-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
                      style={{
                        borderColor: isWarning
                          ? "color-mix(in srgb, var(--warning) 28%, var(--border))"
                          : "var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      {issueContent}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
