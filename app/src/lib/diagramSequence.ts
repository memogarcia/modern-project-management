import type { ArchEdge, DiagramNode, SessionTimelineEntry, TroubleshootingSession } from "@/lib/types";

export interface SequenceParticipant {
  id: string;
  alias: string;
  label: string;
}

export interface SequenceStep {
  id: string;
  kind: "interaction" | "timeline" | "command" | "resolution";
  label: string;
  detail?: string;
}

export interface DerivedSequenceView {
  participants: SequenceParticipant[];
  steps: SequenceStep[];
  mermaidCode: string;
}

function escapeMermaidText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "<br/>")
    .replace(/"/g, '\\"');
}

function sanitizeAlias(value: string): string {
  const normalized = value.replace(/[^A-Za-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || "participant";
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNodeLabel(node: DiagramNode | undefined, fallback: string): string {
  if (!node) return fallback;
  if (node.type === "textNode") return cleanText(node.data.text) || fallback;
  return cleanText(node.data.label) || fallback;
}

function getInteractionLabel(edge: ArchEdge): string {
  const explicit = cleanText(edge.data?.label ?? edge.label);
  const relationship = cleanText(edge.data?.metadata?.relationshipType);
  const protocol = cleanText(edge.data?.metadata?.protocol ?? edge.data?.protocol);

  if (explicit) return explicit;
  if (relationship && protocol) return `${relationship} (${protocol})`;
  if (relationship) return relationship;
  if (protocol) return protocol;
  return "interaction";
}

function sortTimeline(entries: SessionTimelineEntry[]): SessionTimelineEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = Date.parse(a.occurredAt || a.createdAt || "");
    const bTime = Date.parse(b.occurredAt || b.createdAt || "");
    return aTime - bTime;
  });
}

function timelineNote(entry: SessionTimelineEntry): string {
  const title = cleanText(entry.title);
  const body = cleanText(entry.body);
  if (title && body) return `[${entry.kind}] ${title}: ${body}`;
  return `[${entry.kind}] ${title || body || "timeline entry"}`;
}

export function buildSequenceView(
  session: TroubleshootingSession,
  nodes: DiagramNode[],
  edges: ArchEdge[]
): DerivedSequenceView {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const linkedEdgeMap = new Map(edges.map((edge) => [edge.id, edge]));
  const participantIds: string[] = [];
  const participantIdSet = new Set<string>();

  const addParticipant = (nodeId: string) => {
    if (!nodeMap.has(nodeId)) return;
    if (participantIdSet.has(nodeId)) return;
    participantIdSet.add(nodeId);
    participantIds.push(nodeId);
  };

  session.linkedNodeIds.forEach(addParticipant);

  for (const edgeId of session.linkedEdgeIds) {
    const edge = linkedEdgeMap.get(edgeId);
    if (!edge) continue;
    addParticipant(edge.source);
    addParticipant(edge.target);
  }

  if (participantIds.length === 0) {
    const fallbackEdges = edges.filter((edge) => cleanText(edge.data?.label ?? edge.label) || cleanText(edge.data?.metadata?.relationshipType));
    for (const edge of fallbackEdges.slice(0, 6)) {
      addParticipant(edge.source);
      addParticipant(edge.target);
    }
  }

  const participants: SequenceParticipant[] = participantIds.map((nodeId, index) => {
    const label = getNodeLabel(nodeMap.get(nodeId), nodeId);
    return {
      id: nodeId,
      alias: `${sanitizeAlias(label)}_${index + 1}`,
      label,
    };
  });

  const aliasById = new Map(participants.map((participant) => [participant.id, participant.alias]));
  const interactionEdges = session.linkedEdgeIds
    .map((edgeId) => linkedEdgeMap.get(edgeId))
    .filter((edge): edge is ArchEdge => Boolean(edge));

  if (interactionEdges.length === 0 && participants.length > 1) {
    for (const edge of edges) {
      if (!participantIdSet.has(edge.source) || !participantIdSet.has(edge.target)) continue;
      if (!cleanText(edge.data?.label ?? edge.label) && !cleanText(edge.data?.metadata?.relationshipType)) continue;
      interactionEdges.push(edge);
    }
  }

  const steps: SequenceStep[] = [];
  const lines = ["sequenceDiagram", "autonumber", "participant Investigator as Investigator"];

  for (const participant of participants) {
    lines.push(`participant ${participant.alias} as "${escapeMermaidText(participant.label)}"`);
  }

  if (session.summary.trim()) {
    lines.push(`Note over Investigator: ${escapeMermaidText(session.summary.trim())}`);
    steps.push({
      id: "summary",
      kind: "timeline",
      label: session.summary.trim(),
    });
  }

  for (const edge of interactionEdges) {
    const source = aliasById.get(edge.source);
    const target = aliasById.get(edge.target);
    if (!source || !target) continue;
    const label = getInteractionLabel(edge);
    lines.push(`${source}->>${target}: ${escapeMermaidText(label)}`);
    steps.push({
      id: `edge-${edge.id}`,
      kind: "interaction",
      label,
      detail: `${edge.source} -> ${edge.target}`,
    });
  }

  const focusAlias =
    participants.length > 0
      ? aliasById.get(participants[0]!.id) ?? "Investigator"
      : "Investigator";

  for (const command of session.commands) {
    const label = cleanText(command.summary) || cleanText(command.command);
    if (!label) continue;
    lines.push(`Investigator->>${focusAlias}: ${escapeMermaidText(label)}`);
    steps.push({
      id: `command-${command.id}`,
      kind: "command",
      label,
      detail: cleanText(command.command),
    });
  }

  for (const entry of sortTimeline(session.timelineEntries)) {
    const label = timelineNote(entry);
    const noteTargets =
      participants.length >= 2
        ? `${participants[0]!.alias},${participants[participants.length - 1]!.alias}`
        : focusAlias;
    lines.push(`Note over ${noteTargets}: ${escapeMermaidText(label)}`);
    steps.push({
      id: `timeline-${entry.id}`,
      kind: "timeline",
      label,
    });
  }

  if (session.resolutionSummary.trim()) {
    const noteTargets =
      participants.length >= 2
        ? `${participants[0]!.alias},${participants[participants.length - 1]!.alias}`
        : focusAlias;
    lines.push(`Note over ${noteTargets}: ${escapeMermaidText(`Resolution: ${session.resolutionSummary.trim()}`)}`);
    steps.push({
      id: "resolution",
      kind: "resolution",
      label: session.resolutionSummary.trim(),
    });
  }

  if (steps.length === 0) {
    lines.push("Note over Investigator: No linked interactions or timeline entries yet.");
    steps.push({
      id: "empty",
      kind: "timeline",
      label: "No linked interactions or timeline entries yet.",
    });
  }

  return {
    participants,
    steps,
    mermaidCode: `${lines.join("\n")}\n`,
  };
}
