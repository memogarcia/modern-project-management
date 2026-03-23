"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { createNewInvestigation } from "@/lib/factories";
import { investigationClient } from "@/lib/investigationClient";
import type {
  ArtifactReference,
  SessionCommand,
  SessionComment,
  SessionTimelineEntry,
  TroubleshootingSession,
} from "@/lib/types";

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function joinLines(value: string[]): string {
  return value.join("\n");
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

type UseInvestigationWorkspaceOptions = {
  diagramId: string;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
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

function toDraftSession(session: TroubleshootingSession): DraftSession {
  return {
    title: session.title,
    summary: session.summary,
    status: session.status,
    linkedNodeIds: session.linkedNodeIds,
    linkedEdgeIds: session.linkedEdgeIds,
    notesMarkdown: session.notesMarkdown,
    hypothesesText: joinLines(session.hypotheses),
    resolutionSummary: session.resolutionSummary,
  };
}

function updateSession(
  sessions: TroubleshootingSession[],
  sessionId: string,
  updater: (session: TroubleshootingSession) => TroubleshootingSession
): TroubleshootingSession[] {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session));
}

export function useInvestigationWorkspace(options: UseInvestigationWorkspaceOptions) {
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

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [selectedSessionId, sessions]
  );

  const refreshSessions = useEffectEvent(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSessions = await investigationClient.list({
        diagramId: options.diagramId,
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
  });

  useEffect(() => {
    void refreshSessions();
  }, [options.diagramId, deferredSearch]);

  useEffect(() => {
    if (!selectedSession) {
      setDraft(null);
      return;
    }
    setDraft(toDraftSession(selectedSession));
  }, [selectedSession]);

  useEffect(() => {
    const searchBasis = `${draft?.title || ""} ${draft?.summary || ""}`.trim();
    if (!searchBasis) {
      setSearchHits([]);
      return;
    }

    void investigationClient
      .searchMemory({
        q: searchBasis,
        diagramId: options.diagramId,
        limit: 5,
      })
      .then((results) => setSearchHits(results.filter((result) => result.id !== selectedSessionId)))
      .catch(() => setSearchHits([]));
  }, [draft?.summary, draft?.title, options.diagramId, selectedSessionId]);

  async function createSession(): Promise<void> {
    if (!createTitle.trim() || !createSummary.trim()) return;

    setIsSaving(true);
    setError(null);
    try {
      const session = await investigationClient.create(
        createNewInvestigation({
          diagramId: options.diagramId,
          title: createTitle,
          summary: createSummary,
          linkedNodeIds: options.selectedNodeIds,
          linkedEdgeIds: options.selectedEdgeIds,
        })
      );
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
  }

  async function saveSession(): Promise<void> {
    if (!selectedSession || !draft) return;

    setIsSaving(true);
    setError(null);
    try {
      const updated = await investigationClient.patch(selectedSession.id, {
        title: draft.title.trim(),
        summary: draft.summary.trim(),
        status: draft.status,
        linkedNodeIds: draft.linkedNodeIds,
        linkedEdgeIds: draft.linkedEdgeIds,
        notesMarkdown: draft.notesMarkdown,
        hypotheses: splitLines(draft.hypothesesText),
        resolutionSummary: draft.resolutionSummary,
      });
      setSessions((current) => updateSession(current, updated.id, () => updated));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save investigation");
    } finally {
      setIsSaving(false);
    }
  }

  async function addTimelineEntry(): Promise<void> {
    if (!selectedSession || !timelineEntry.title.trim()) return;

    setIsSaving(true);
    try {
      const created = await investigationClient.appendTimelineEntry(selectedSession.id, {
        ...timelineEntry,
        occurredAt: new Date().toISOString(),
      });
      setSessions((current) =>
        updateSession(current, selectedSession.id, (session) => ({
          ...session,
          timelineEntries: [...session.timelineEntries, created],
        }))
      );
      setTimelineEntry(EMPTY_TIMELINE_ENTRY);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append timeline entry");
    } finally {
      setIsSaving(false);
    }
  }

  async function addCommand(): Promise<void> {
    if (!selectedSession || !commandDraft.command.trim()) return;

    setIsSaving(true);
    try {
      const created = await investigationClient.appendCommand(selectedSession.id, commandDraft);
      setSessions((current) =>
        updateSession(current, selectedSession.id, (session) => ({
          ...session,
          commands: [...session.commands, created],
        }))
      );
      setCommandDraft(EMPTY_COMMAND);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append command");
    } finally {
      setIsSaving(false);
    }
  }

  async function addComment(): Promise<void> {
    if (!selectedSession || !commentDraft.author.trim() || !commentDraft.body.trim()) return;

    setIsSaving(true);
    try {
      const created = await investigationClient.appendComment(selectedSession.id, commentDraft);
      setSessions((current) =>
        updateSession(current, selectedSession.id, (session) => ({
          ...session,
          comments: [...session.comments, created],
        }))
      );
      setCommentDraft(EMPTY_COMMENT);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to append comment");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadSessionArtifact(file: File): Promise<void> {
    if (!selectedSession) return;

    setUploadError(null);
    try {
      const artifact = await investigationClient.uploadArtifact({
        ownerType: "session",
        ownerId: selectedSession.id,
        diagramId: options.diagramId,
        label: file.name,
        file,
      });
      setSessions((current) =>
        updateSession(current, selectedSession.id, (session) => ({
          ...session,
          artifacts: [artifact, ...session.artifacts],
        }))
      );
    } catch (requestError) {
      setUploadError(requestError instanceof Error ? requestError.message : "Upload failed");
    }
  }

  async function extractReusablePattern(): Promise<void> {
    if (!selectedSession || !draft) return;

    setIsSaving(true);
    try {
      await investigationClient.extractPattern(selectedSession.id, {
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
  }

  return {
    commandDraft,
    commentDraft,
    createSummary,
    createTitle,
    draft,
    error,
    isLoading,
    isSaving,
    query,
    searchHits,
    selectedSession,
    selectedSessionId,
    sessions,
    showCreate,
    timelineEntry,
    uploadError,
    setCommandDraft,
    setCommentDraft,
    setCreateSummary,
    setCreateTitle,
    setDraft,
    setQuery,
    setSelectedSessionId,
    setShowCreate,
    setTimelineEntry,
    addCommand,
    addComment,
    addTimelineEntry,
    createSession,
    extractReusablePattern,
    refreshSessions,
    saveSession,
    uploadSessionArtifact,
  };
}

export type InvestigationWorkspaceState = ReturnType<typeof useInvestigationWorkspace>;
export type InvestigationWorkspaceDraft = DraftSession;
export type InvestigationWorkspaceArtifact = ArtifactReference;
