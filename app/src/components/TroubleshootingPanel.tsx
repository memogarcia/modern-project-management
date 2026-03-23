"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ArtifactReference,
  SessionCommand,
  SessionComment,
  SessionTimelineEntry,
  TroubleshootingSession,
} from "@/lib/types";
import {
  appendInvestigationCommand,
  appendInvestigationComment,
  appendInvestigationTimelineEntry,
  createInvestigation,
  extractPattern,
  listInvestigations,
  patchInvestigation,
  searchTroubleshootingMemory,
  uploadArtifact,
} from "@/lib/investigationStorage";
import { Button } from "@/components/ui/button";

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(value: string[]): string {
  return value.join("\n");
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

type DraftSession = {
  title: string;
  summary: string;
  status: TroubleshootingSession["status"];
  linkedNodeIds: string[];
  linkedEdgeIds: string[];
  notesMarkdown: string;
  hypothesesText: string;
  resolutionSummary: string;
};

const EMPTY_TIMELINE_ENTRY = {
  kind: "observation" as SessionTimelineEntry["kind"],
  title: "",
  body: "",
  author: "",
};

const EMPTY_COMMAND = {
  command: "",
  summary: "",
  outputExcerpt: "",
  status: "ran" as SessionCommand["status"],
};

const EMPTY_COMMENT = {
  author: "",
  body: "",
};

export default function TroubleshootingPanel(props: {
  diagramId: string;
  nodes: Array<{ id: string; data: { label?: string } }>;
  edges: Array<{ id: string; source: string; target: string; label?: string; data?: { label?: string } }>;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
}) {
  const [sessions, setSessions] = useState<TroubleshootingSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createSummary, setCreateSummary] = useState("");
  const [timelineEntry, setTimelineEntry] = useState(EMPTY_TIMELINE_ENTRY);
  const [commandDraft, setCommandDraft] = useState(EMPTY_COMMAND);
  const [commentDraft, setCommentDraft] = useState(EMPTY_COMMENT);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchHits, setSearchHits] = useState<Array<{ id: string; title: string; summary: string; type: string }>>([]);

  const deferredSearch = useDeferredValue(query);
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

  const refreshSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSessions = await listInvestigations({
        diagramId: props.diagramId,
        q: deferredSearch || undefined,
      });
      startTransition(() => {
        setSessions(nextSessions);
        if (nextSessions.length === 0) {
          setSelectedSessionId(null);
          setDraft(null);
          return;
        }
        setSelectedSessionId((current) =>
          current && nextSessions.some((session) => session.id === current)
            ? current
            : nextSessions[0].id
        );
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load investigations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshSessions();
  }, [props.diagramId, deferredSearch]);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  useEffect(() => {
    if (!selectedSession) {
      setDraft(null);
      return;
    }
    setDraft({
      title: selectedSession.title,
      summary: selectedSession.summary,
      status: selectedSession.status,
      linkedNodeIds: selectedSession.linkedNodeIds,
      linkedEdgeIds: selectedSession.linkedEdgeIds,
      notesMarkdown: selectedSession.notesMarkdown,
      hypothesesText: joinLines(selectedSession.hypotheses),
      resolutionSummary: selectedSession.resolutionSummary,
    });
  }, [selectedSession]);

  useEffect(() => {
    const searchBasis = `${draft?.title || ""} ${draft?.summary || ""}`.trim();
    if (!searchBasis) {
      setSearchHits([]);
      return;
    }
    void searchTroubleshootingMemory({
      q: searchBasis,
      diagramId: props.diagramId,
      limit: 5,
    })
      .then((results) => setSearchHits(results.filter((result) => result.id !== selectedSessionId)))
      .catch(() => setSearchHits([]));
  }, [draft?.summary, draft?.title, props.diagramId, selectedSessionId]);

  const handleCreate = async () => {
    if (!createTitle.trim() || !createSummary.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const session = await createInvestigation({
        id: crypto.randomUUID(),
        diagramId: props.diagramId,
        projectId: null,
        systemScope: "",
        title: createTitle.trim(),
        summary: createSummary.trim(),
        status: "open",
        linkedNodeIds: props.selectedNodeIds,
        linkedEdgeIds: props.selectedEdgeIds,
        notesMarkdown: "",
        hypotheses: [],
        aiTranscriptReferences: [],
        resolutionSummary: "",
        reusablePatternId: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSessions((current) => [session, ...current]);
      setSelectedSessionId(session.id);
      setShowCreate(false);
      setCreateTitle("");
      setCreateSummary("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create investigation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedSession || !draft) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await patchInvestigation(selectedSession.id, {
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        status: draft.status,
        linkedNodeIds: draft.linkedNodeIds,
        linkedEdgeIds: draft.linkedEdgeIds,
        notesMarkdown: draft.notesMarkdown,
        hypotheses: splitLines(draft.hypothesesText),
        resolutionSummary: draft.resolutionSummary,
      });
      setSessions((current) =>
        current.map((session) => (session.id === updated.id ? updated : session))
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save investigation");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTimeline = async () => {
    if (!selectedSession || !timelineEntry.title.trim()) return;
    setIsSaving(true);
    try {
      const created = await appendInvestigationTimelineEntry(selectedSession.id, {
        ...timelineEntry,
        occurredAt: new Date().toISOString(),
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id
            ? {
                ...session,
                timelineEntries: [...session.timelineEntries, created],
              }
            : session
        )
      );
      setTimelineEntry(EMPTY_TIMELINE_ENTRY);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append timeline entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddCommand = async () => {
    if (!selectedSession || !commandDraft.command.trim()) return;
    setIsSaving(true);
    try {
      const created = await appendInvestigationCommand(selectedSession.id, commandDraft);
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id
            ? { ...session, commands: [...session.commands, created] }
            : session
        )
      );
      setCommandDraft(EMPTY_COMMAND);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append command");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedSession || !commentDraft.author.trim() || !commentDraft.body.trim()) return;
    setIsSaving(true);
    try {
      const created = await appendInvestigationComment(selectedSession.id, commentDraft);
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id
            ? { ...session, comments: [...session.comments, created] }
            : session
        )
      );
      setCommentDraft(EMPTY_COMMENT);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append comment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedSession) return;
    setUploadError(null);
    try {
      const artifact = await uploadArtifact({
        ownerType: "session",
        ownerId: selectedSession.id,
        diagramId: props.diagramId,
        label: file.name,
        file,
      });
      setSessions((current) =>
        current.map((session) =>
          session.id === selectedSession.id
            ? { ...session, artifacts: [artifact, ...session.artifacts] }
            : session
        )
      );
    } catch (requestError) {
      setUploadError(requestError instanceof Error ? requestError.message : "Upload failed");
    } finally {
      event.target.value = "";
    }
  };

  const handleExtractPattern = async () => {
    if (!selectedSession || !draft) return;
    setIsSaving(true);
    try {
      await extractPattern(selectedSession.id, {
        title: draft.title,
        summary: draft.summary,
        symptom: draft.summary,
        resolution: draft.resolutionSummary || selectedSession.resolutionSummary || "Pending resolution",
        tags: splitLines(draft.hypothesesText).slice(0, 5),
      });
      await refreshSessions();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to extract pattern");
    } finally {
      setIsSaving(false);
    }
  };

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
        <Button size="sm" onClick={() => setShowCreate((current) => !current)}>
          {showCreate ? "Close" : "New"}
        </Button>
      </div>

      <div className="border-b border-[var(--border)] px-3 py-3">
        <input
          className="edit-modal-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, symptom, notes, or resolution"
        />
        {showCreate && (
          <div className="mt-3 space-y-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
            <input className="edit-modal-input" value={createTitle} onChange={(event) => setCreateTitle(event.target.value)} placeholder="Investigation title" />
            <textarea className="edit-modal-input" rows={3} value={createSummary} onChange={(event) => setCreateSummary(event.target.value)} placeholder="Symptom or triggering condition" />
            <div className="text-[11px] text-[var(--text-muted)]">
              New investigations start linked to the currently selected nodes and edges.
            </div>
            <Button size="sm" onClick={() => void handleCreate()} disabled={isSaving}>
              Create investigation
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="border-b border-[var(--border)] bg-[color:color-mix(in_srgb,var(--danger)_12%,var(--panel-bg))] px-3 py-2 text-xs font-medium text-[var(--danger)]">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[220px,1fr]">
        <div className="min-h-0 overflow-y-auto border-r border-[var(--border)]">
          {isLoading ? (
            <div className="p-3 text-xs text-[var(--text-muted)]">Loading investigations...</div>
          ) : sessions.length === 0 ? (
            <div className="p-3 text-xs text-[var(--text-muted)]">No investigations linked to this diagram yet.</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                className={`flex w-full flex-col items-start gap-1 border-b border-[var(--border)] px-3 py-3 text-left transition-colors ${
                  selectedSessionId === session.id ? "bg-[var(--surface)]" : "hover:bg-[var(--surface)]"
                }`}
                onClick={() => setSelectedSessionId(session.id)}
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
                  <input className="edit-modal-input" value={draft.title} onChange={(event) => setDraft((current) => current ? { ...current, title: event.target.value } : current)} />
                  <select className="edit-modal-input" value={draft.status} onChange={(event) => setDraft((current) => current ? { ...current, status: event.target.value as TroubleshootingSession["status"] } : current)}>
                    <option value="open">Open</option>
                    <option value="resolved">Resolved</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <textarea className="edit-modal-input" rows={3} value={draft.summary} onChange={(event) => setDraft((current) => current ? { ...current, summary: event.target.value } : current)} placeholder="Symptom or impact summary" />
                <textarea className="edit-modal-input" rows={6} value={draft.notesMarkdown} onChange={(event) => setDraft((current) => current ? { ...current, notesMarkdown: event.target.value } : current)} placeholder="Investigation notes in Markdown" />
                <textarea className="edit-modal-input" rows={4} value={draft.hypothesesText} onChange={(event) => setDraft((current) => current ? { ...current, hypothesesText: event.target.value } : current)} placeholder="One hypothesis per line" />
                <textarea className="edit-modal-input" rows={4} value={draft.resolutionSummary} onChange={(event) => setDraft((current) => current ? { ...current, resolutionSummary: event.target.value } : current)} placeholder="Resolution summary" />
                <Button size="sm" onClick={() => void handleSave()} disabled={isSaving}>
                  Save investigation
                </Button>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Linked nodes</div>
                <div className="grid gap-2">
                  {nodeOptions.map((node) => (
                    <label key={node.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.linkedNodeIds.includes(node.id)}
                        onChange={() =>
                          setDraft((current) =>
                            current ? { ...current, linkedNodeIds: toggleId(current.linkedNodeIds, node.id) } : current
                          )
                        }
                      />
                      <span>{node.label}</span>
                    </label>
                  ))}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Linked edges</div>
                <div className="grid gap-2">
                  {edgeOptions.map((edge) => (
                    <label key={edge.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draft.linkedEdgeIds.includes(edge.id)}
                        onChange={() =>
                          setDraft((current) =>
                            current ? { ...current, linkedEdgeIds: toggleId(current.linkedEdgeIds, edge.id) } : current
                          )
                        }
                      />
                      <span>{edge.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Timeline</div>
                <div className="space-y-2">
                  {selectedSession.timelineEntries.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-medium text-[var(--foreground)]">{entry.title}</div>
                      <div className="text-[var(--text-muted)]">{entry.body}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <select className="edit-modal-input" value={timelineEntry.kind} onChange={(event) => setTimelineEntry((current) => ({ ...current, kind: event.target.value as SessionTimelineEntry["kind"] }))}>
                    <option value="observation">Observation</option>
                    <option value="hypothesis">Hypothesis</option>
                    <option value="command">Command</option>
                    <option value="comment">Comment</option>
                    <option value="status">Status</option>
                    <option value="resolution">Resolution</option>
                  </select>
                  <input className="edit-modal-input" value={timelineEntry.title} onChange={(event) => setTimelineEntry((current) => ({ ...current, title: event.target.value }))} placeholder="Timeline title" />
                  <textarea className="edit-modal-input" rows={3} value={timelineEntry.body} onChange={(event) => setTimelineEntry((current) => ({ ...current, body: event.target.value }))} placeholder="What happened?" />
                  <input className="edit-modal-input" value={timelineEntry.author} onChange={(event) => setTimelineEntry((current) => ({ ...current, author: event.target.value }))} placeholder="Author" />
                  <Button size="sm" onClick={() => void handleAddTimeline()} disabled={isSaving}>Add timeline entry</Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Commands</div>
                <div className="space-y-2">
                  {selectedSession.commands.map((command) => (
                    <div key={command.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-mono text-[var(--foreground)]">{command.command}</div>
                      <div className="text-[var(--text-muted)]">{command.summary}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <input className="edit-modal-input" value={commandDraft.command} onChange={(event) => setCommandDraft((current) => ({ ...current, command: event.target.value }))} placeholder="kubectl logs ... or curl ..." />
                  <input className="edit-modal-input" value={commandDraft.summary} onChange={(event) => setCommandDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="What this command checked" />
                  <textarea className="edit-modal-input" rows={3} value={commandDraft.outputExcerpt} onChange={(event) => setCommandDraft((current) => ({ ...current, outputExcerpt: event.target.value }))} placeholder="Important output excerpt" />
                  <Button size="sm" onClick={() => void handleAddCommand()} disabled={isSaving}>Add command</Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Comments</div>
                <div className="space-y-2">
                  {selectedSession.comments.map((comment) => (
                    <div key={comment.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-medium text-[var(--foreground)]">{comment.author}</div>
                      <div className="text-[var(--text-muted)]">{comment.body}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <input className="edit-modal-input" value={commentDraft.author} onChange={(event) => setCommentDraft((current) => ({ ...current, author: event.target.value }))} placeholder="Author" />
                  <textarea className="edit-modal-input" rows={3} value={commentDraft.body} onChange={(event) => setCommentDraft((current) => ({ ...current, body: event.target.value }))} placeholder="Comment body" />
                  <Button size="sm" onClick={() => void handleAddComment()} disabled={isSaving}>Add comment</Button>
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Artifacts</div>
                  <label className="cursor-pointer rounded-md border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--foreground)]">
                    Upload
                    <input hidden type="file" onChange={(event) => void handleUpload(event)} />
                  </label>
                </div>
                {uploadError && <div className="text-xs text-[var(--danger)]">{uploadError}</div>}
                <div className="space-y-2">
                  {selectedSession.artifacts.map((artifact: ArtifactReference) => (
                    <div key={artifact.id} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                      <div className="font-medium text-[var(--foreground)]">{artifact.label}</div>
                      <div className="text-[var(--text-muted)]">{artifact.fileName}</div>
                    </div>
                  ))}
                  {selectedSession.artifacts.length === 0 && (
                    <div className="text-xs text-[var(--text-muted)]">No artifacts attached yet.</div>
                  )}
                </div>
              </section>

              <section className="space-y-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">Similar memory</div>
                <div className="space-y-2">
                  {searchHits.length === 0 ? (
                    <div className="text-xs text-[var(--text-muted)]">No similar sessions or patterns yet.</div>
                  ) : (
                    searchHits.map((hit) => (
                      <div key={`${hit.type}:${hit.id}`} className="rounded-md border border-[var(--border)] px-3 py-2 text-xs">
                        <div className="font-medium text-[var(--foreground)]">{hit.title}</div>
                        <div className="text-[var(--text-muted)]">{hit.summary}</div>
                      </div>
                    ))
                  )}
                </div>
                <Button size="sm" onClick={() => void handleExtractPattern()} disabled={isSaving}>
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
