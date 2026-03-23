"use client";

import type { ChangeEvent } from "react";
import { useMemo } from "react";
import type { ArtifactReference, SessionTimelineEntry, TroubleshootingSession } from "@/lib/types";
import { useInvestigationWorkspace } from "@/hooks/useInvestigationWorkspace";
import { Button } from "@/components/ui/button";

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

export default function TroubleshootingPanel(props: {
  diagramId: string;
  nodes: Array<{ id: string; data: { label?: string } }>;
  edges: Array<{ id: string; source: string; target: string; label?: string; data?: { label?: string } }>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
}) {
  const workspace = useInvestigationWorkspace({
    diagramId: props.diagramId,
    selectedNodeIds: props.selectedNodeIds,
    selectedEdgeIds: props.selectedEdgeIds,
  });

  const nodeOptions = useMemo(
    () =>
      props.nodes.map((node) => ({
        id: node.id,
        label: node.data.label || node.id,
      })),
    [props.nodes]
  );

  const edgeOptions = useMemo(
    () =>
      props.edges.map((edge) => ({
        id: edge.id,
        label: edge.data?.label || edge.label || `${edge.source} -> ${edge.target}`,
      })),
    [props.edges]
  );

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await workspace.uploadSessionArtifact(file);
    }
    event.target.value = "";
  };

  const selectedSession = workspace.selectedSession;
  const draft = workspace.draft;

  return (
    <div className="flex h-full flex-col bg-[var(--panel-bg)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-3">
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
            Investigations
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            Diagram-linked troubleshooting memory
          </div>
        </div>
        <Button size="sm" onClick={() => workspace.setShowCreate((current) => !current)}>
          {workspace.showCreate ? "Close" : "New"}
        </Button>
      </div>

      <div className="border-b border-[var(--border)] px-3 py-3">
        <input
          className="edit-modal-input"
          value={workspace.query}
          onChange={(event) => workspace.setQuery(event.target.value)}
          placeholder="Search title, symptom, notes, or resolution"
        />
        {workspace.showCreate && (
          <div className="mt-3 space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <input
              className="edit-modal-input"
              value={workspace.createTitle}
              onChange={(event) => workspace.setCreateTitle(event.target.value)}
              placeholder="Investigation title"
            />
            <textarea
              className="edit-modal-input"
              rows={3}
              value={workspace.createSummary}
              onChange={(event) => workspace.setCreateSummary(event.target.value)}
              placeholder="Symptom or triggering condition"
            />
            <div className="text-[11px] text-[var(--text-muted)]">
              New investigations start linked to the currently selected nodes and edges.
            </div>
            <Button size="sm" onClick={() => void workspace.createSession()} disabled={workspace.isSaving}>
              Create investigation
            </Button>
          </div>
        )}
      </div>

      {workspace.error && (
        <div className="border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--danger)_12%,var(--panel-bg))] px-3 py-2 text-xs font-medium text-[var(--danger)]">
          {workspace.error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[220px,1fr]">
        <div className="min-h-0 overflow-y-auto border-r border-[var(--border)]">
          {workspace.isLoading ? (
            <div className="p-3 text-xs text-[var(--text-muted)]">Loading investigations...</div>
          ) : workspace.sessions.length === 0 ? (
            <div className="p-3 text-xs text-[var(--text-muted)]">
              No investigations linked to this diagram yet.
            </div>
          ) : (
            workspace.sessions.map((session) => (
              <button
                key={session.id}
                className={`flex w-full flex-col items-start gap-1 border-b border-[var(--border)] px-3 py-3 text-left transition-colors ${
                  workspace.selectedSessionId === session.id
                    ? "bg-[var(--surface)]"
                    : "hover:bg-[var(--surface)]"
                }`}
                onClick={() => workspace.setSelectedSessionId(session.id)}
              >
                <div className="text-xs font-semibold text-[var(--foreground)]">{session.title}</div>
                <div className="line-clamp-2 text-[11px] text-[var(--text-muted)]">{session.summary}</div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  {session.status} · {session.linkedNodeIds.length} nodes · {session.linkedEdgeIds.length} edges
                </div>
              </button>
            ))
          )}
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          {!selectedSession || !draft ? (
            <div className="rounded-md border border-dashed border-[var(--border)] px-4 py-6 text-sm text-[var(--text-muted)]">
              Select an investigation to edit notes, commands, evidence, and reusable patterns.
            </div>
          ) : (
            <div className="space-y-4">
              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="edit-modal-input"
                    value={draft.title}
                    onChange={(event) =>
                      workspace.setDraft((current) =>
                        current ? { ...current, title: event.target.value } : current
                      )
                    }
                  />
                  <select
                    className="edit-modal-input"
                    value={draft.status}
                    onChange={(event) =>
                      workspace.setDraft((current) =>
                        current
                          ? {
                              ...current,
                              status: event.target.value as TroubleshootingSession["status"],
                            }
                          : current
                      )
                    }
                  >
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <textarea
                  className="edit-modal-input"
                  rows={3}
                  value={draft.summary}
                  onChange={(event) =>
                    workspace.setDraft((current) =>
                      current ? { ...current, summary: event.target.value } : current
                    )
                  }
                  placeholder="Symptom or impact summary"
                />
                <textarea
                  className="edit-modal-input"
                  rows={6}
                  value={draft.notesMarkdown}
                  onChange={(event) =>
                    workspace.setDraft((current) =>
                      current ? { ...current, notesMarkdown: event.target.value } : current
                    )
                  }
                  placeholder="Investigation notes in Markdown"
                />
                <textarea
                  className="edit-modal-input"
                  rows={4}
                  value={draft.hypothesesText}
                  onChange={(event) =>
                    workspace.setDraft((current) =>
                      current ? { ...current, hypothesesText: event.target.value } : current
                    )
                  }
                  placeholder="One hypothesis per line"
                />
                <textarea
                  className="edit-modal-input"
                  rows={4}
                  value={draft.resolutionSummary}
                  onChange={(event) =>
                    workspace.setDraft((current) =>
                      current ? { ...current, resolutionSummary: event.target.value } : current
                    )
                  }
                  placeholder="Resolution summary"
                />
                <Button size="sm" onClick={() => void workspace.saveSession()} disabled={workspace.isSaving}>
                  Save investigation
                </Button>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Linked nodes
                </div>
                <div className="grid gap-2">
                  {nodeOptions.map((node) => (
                    <label key={node.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.linkedNodeIds.includes(node.id)}
                        onChange={() =>
                          workspace.setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  linkedNodeIds: toggleId(current.linkedNodeIds, node.id),
                                }
                              : current
                          )
                        }
                      />
                      <span>{node.label}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Linked edges
                </div>
                <div className="grid gap-2">
                  {edgeOptions.map((edge) => (
                    <label key={edge.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.linkedEdgeIds.includes(edge.id)}
                        onChange={() =>
                          workspace.setDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  linkedEdgeIds: toggleId(current.linkedEdgeIds, edge.id),
                                }
                              : current
                          )
                        }
                      />
                      <span>{edge.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Timeline
                </div>
                <div className="space-y-2">
                  {selectedSession.timelineEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-medium text-[var(--foreground)]">{entry.title}</div>
                      <div className="text-[var(--text-muted)]">{entry.body}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <select
                    className="edit-modal-input"
                    value={workspace.timelineEntry.kind}
                    onChange={(event) =>
                      workspace.setTimelineEntry((current) => ({
                        ...current,
                        kind: event.target.value as SessionTimelineEntry["kind"],
                      }))
                    }
                  >
                    <option value="observation">Observation</option>
                    <option value="hypothesis">Hypothesis</option>
                    <option value="command">Command</option>
                    <option value="comment">Comment</option>
                    <option value="status">Status</option>
                    <option value="resolution">Resolution</option>
                  </select>
                  <input
                    className="edit-modal-input"
                    value={workspace.timelineEntry.title}
                    onChange={(event) =>
                      workspace.setTimelineEntry((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Timeline title"
                  />
                  <textarea
                    className="edit-modal-input"
                    rows={3}
                    value={workspace.timelineEntry.body}
                    onChange={(event) =>
                      workspace.setTimelineEntry((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="What happened?"
                  />
                  <input
                    className="edit-modal-input"
                    value={workspace.timelineEntry.author}
                    onChange={(event) =>
                      workspace.setTimelineEntry((current) => ({
                        ...current,
                        author: event.target.value,
                      }))
                    }
                    placeholder="Author"
                  />
                  <Button
                    size="sm"
                    onClick={() => void workspace.addTimelineEntry()}
                    disabled={workspace.isSaving}
                  >
                    Add timeline entry
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Commands
                </div>
                <div className="space-y-2">
                  {selectedSession.commands.map((command) => (
                    <div key={command.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-mono text-[var(--foreground)]">{command.command}</div>
                      <div className="text-[var(--text-muted)]">{command.summary}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <input
                    className="edit-modal-input"
                    value={workspace.commandDraft.command}
                    onChange={(event) =>
                      workspace.setCommandDraft((current) => ({
                        ...current,
                        command: event.target.value,
                      }))
                    }
                    placeholder="kubectl logs ... or curl ..."
                  />
                  <input
                    className="edit-modal-input"
                    value={workspace.commandDraft.summary}
                    onChange={(event) =>
                      workspace.setCommandDraft((current) => ({
                        ...current,
                        summary: event.target.value,
                      }))
                    }
                    placeholder="What this command checked"
                  />
                  <textarea
                    className="edit-modal-input"
                    rows={3}
                    value={workspace.commandDraft.outputExcerpt}
                    onChange={(event) =>
                      workspace.setCommandDraft((current) => ({
                        ...current,
                        outputExcerpt: event.target.value,
                      }))
                    }
                    placeholder="Important output excerpt"
                  />
                  <Button size="sm" onClick={() => void workspace.addCommand()} disabled={workspace.isSaving}>
                    Add command
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Comments
                </div>
                <div className="space-y-2">
                  {selectedSession.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-medium text-[var(--foreground)]">{comment.author}</div>
                      <div className="text-[var(--text-muted)]">{comment.body}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <input
                    className="edit-modal-input"
                    value={workspace.commentDraft.author}
                    onChange={(event) =>
                      workspace.setCommentDraft((current) => ({
                        ...current,
                        author: event.target.value,
                      }))
                    }
                    placeholder="Author"
                  />
                  <textarea
                    className="edit-modal-input"
                    rows={3}
                    value={workspace.commentDraft.body}
                    onChange={(event) =>
                      workspace.setCommentDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Comment body"
                  />
                  <Button size="sm" onClick={() => void workspace.addComment()} disabled={workspace.isSaving}>
                    Add comment
                  </Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    Artifacts
                  </div>
                  <label className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                    Upload
                    <input hidden type="file" onChange={(event) => void handleUpload(event)} />
                  </label>
                </div>
                {workspace.uploadError && <div className="text-xs text-[var(--danger)]">{workspace.uploadError}</div>}
                <div className="space-y-2">
                  {selectedSession.artifacts.map((artifact: ArtifactReference) => (
                    <ArtifactRow key={artifact.id} artifact={artifact} />
                  ))}
                  {selectedSession.artifacts.length === 0 && (
                    <div className="text-xs text-[var(--text-muted)]">No artifacts attached yet.</div>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
                  Similar memory
                </div>
                <div className="space-y-2">
                  {workspace.searchHits.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">
                      No similar sessions or patterns yet.
                    </div>
                  ) : (
                    workspace.searchHits.map((hit) => (
                      <div key={`${hit.type}:${hit.id}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-[var(--foreground)]">{hit.title}</div>
                          <div className="uppercase tracking-[0.12em] text-[var(--text-muted)]">{hit.type}</div>
                        </div>
                        <div className="text-[var(--text-muted)]">{hit.summary}</div>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => void workspace.extractReusablePattern()}
                  disabled={workspace.isSaving}
                >
                  Extract reusable pattern
                </Button>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactRow(props: { artifact: ArtifactReference }) {
  const artifact = props.artifact;
  return (
    <div className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium text-[var(--foreground)]">{artifact.label}</div>
          <div className="text-[var(--text-muted)]">{artifact.fileName}</div>
        </div>
        <a
          className="font-medium text-[var(--accent)] hover:underline"
          href={`/api/artifacts/${artifact.artifactId}`}
        >
          Download
        </a>
      </div>
    </div>
  );
}
