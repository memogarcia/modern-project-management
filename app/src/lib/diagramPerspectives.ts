import type {
  ArchEdge,
  ArchNode,
  DiagramNode,
  DiagramPerspective,
  DiagramPerspectiveKind,
  TroubleshootingSession,
} from "@/lib/types";

export type { DiagramPerspective, DiagramPerspectiveKind } from "@/lib/types";

export interface DiagramPerspectiveVisibility {
  visibleNodeIds: Set<string>;
  visibleEdgeIds: Set<string>;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function isArchNode(node: DiagramNode): node is ArchNode {
  return node.type === "archNode";
}

function isActionableNode(node: DiagramNode): boolean {
  return node.type !== "groupNode" && node.type !== "textNode";
}

function includesOperationalContext(node: ArchNode): boolean {
  const metadata = node.data.metadata;
  if (!metadata) return false;

  return Boolean(
    metadata.owner ||
      metadata.knownFailureModes.length > 0 ||
      metadata.documentationLinks.length > 0 ||
      metadata.dashboardLinks.length > 0 ||
      metadata.logLinks.length > 0 ||
      metadata.traceLinks.length > 0 ||
      metadata.runbookLinks.length > 0
  );
}

function includesSecurityContext(edge: ArchEdge): boolean {
  const relationship = String(edge.data?.metadata?.relationshipType ?? "").toLowerCase();
  const protocol = String(edge.data?.metadata?.protocol ?? edge.data?.protocol ?? "").toLowerCase();
  const auth = String(edge.data?.metadata?.authAssumptions ?? "").toLowerCase();

  return Boolean(
    auth ||
      /(http|https|grpc|graphql|tls|mtls|jwt|oauth|oidc)/.test(protocol) ||
      /(auth|token|claim|tls|mtls|permission|authorization)/.test(relationship)
  );
}

function createPerspective(input: {
  title: string;
  description: string;
  kind: DiagramPerspectiveKind;
  nodeIds: string[];
  edgeIds: string[];
  existingId?: string;
  createdAt?: string;
}): DiagramPerspective {
  const now = new Date().toISOString();
  return {
    id: input.existingId ?? crypto.randomUUID(),
    title: input.title,
    description: input.description,
    kind: input.kind,
    nodeIds: uniqueSorted(input.nodeIds),
    edgeIds: uniqueSorted(input.edgeIds),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function createPerspectiveFromSelection(input: {
  title: string;
  description: string;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  edges: ArchEdge[];
  existingId?: string;
  createdAt?: string;
}): DiagramPerspective {
  const nodeIds = new Set(input.selectedNodeIds);
  for (const edge of input.edges) {
    if (!input.selectedEdgeIds.includes(edge.id)) continue;
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  }

  return createPerspective({
    title: input.title,
    description: input.description,
    kind: "custom",
    nodeIds: [...nodeIds],
    edgeIds: input.selectedEdgeIds,
    existingId: input.existingId,
    createdAt: input.createdAt,
  });
}

export function buildSuggestedPerspective(
  kind: Exclude<DiagramPerspectiveKind, "custom">,
  nodes: DiagramNode[],
  edges: ArchEdge[],
  sessions: TroubleshootingSession[],
  existing?: DiagramPerspective
): DiagramPerspective {
  const actionableNodes = nodes.filter(isActionableNode);
  const actionableIds = new Set(actionableNodes.map((node) => node.id));
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (kind === "onboarding") {
    for (const node of actionableNodes) {
      if (!isArchNode(node)) {
        nodeIds.add(node.id);
        continue;
      }
      if (!["cloud", "custom"].includes(node.data.shapeType)) {
        nodeIds.add(node.id);
      }
    }
  }

  if (kind === "operations") {
    const openSessions = sessions.filter((session) => session.status === "open");
    for (const session of openSessions) {
      session.linkedNodeIds.forEach((id) => nodeIds.add(id));
      session.linkedEdgeIds.forEach((id) => edgeIds.add(id));
    }

    for (const node of actionableNodes) {
      if (isArchNode(node) && includesOperationalContext(node)) {
        nodeIds.add(node.id);
      }
    }

    if (nodeIds.size === 0) {
      actionableNodes.forEach((node) => nodeIds.add(node.id));
    }
  }

  if (kind === "security") {
    for (const edge of edges) {
      if (!includesSecurityContext(edge)) continue;
      edgeIds.add(edge.id);
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }

    for (const node of actionableNodes) {
      if (!isArchNode(node)) continue;
      if (["gateway", "client", "cloud"].includes(node.data.shapeType)) {
        nodeIds.add(node.id);
      }
    }

    if (nodeIds.size === 0) {
      actionableNodes.forEach((node) => nodeIds.add(node.id));
    }
  }

  for (const edge of edges) {
    const sourceIncluded = nodeIds.has(edge.source);
    const targetIncluded = nodeIds.has(edge.target);
    if (sourceIncluded && targetIncluded) edgeIds.add(edge.id);
    if (edgeIds.has(edge.id)) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  const filteredNodeIds = [...nodeIds].filter((id) => actionableIds.has(id));

  const titles: Record<Exclude<DiagramPerspectiveKind, "custom">, string> = {
    onboarding: "Onboarding view",
    operations: "Operations view",
    security: "Security view",
  };

  const descriptions: Record<Exclude<DiagramPerspectiveKind, "custom">, string> = {
    onboarding: "A reduced system view for explaining the main architecture and request path.",
    operations: "A troubleshooting-oriented view that favors owned components, live investigation scope, and operational entry points.",
    security: "A focused dependency view for auth assumptions, trust boundaries, and externally exposed flows.",
  };

  return createPerspective({
    title: titles[kind],
    description: descriptions[kind],
    kind,
    nodeIds: filteredNodeIds,
    edgeIds: [...edgeIds],
    existingId: existing?.id,
    createdAt: existing?.createdAt,
  });
}

export function computePerspectiveVisibility(
  perspective: DiagramPerspective,
  nodes: DiagramNode[],
  edges: ArchEdge[]
): DiagramPerspectiveVisibility {
  const visibleNodeIds = new Set(perspective.nodeIds);
  const visibleEdgeIds = new Set<string>();
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const explicitEdgeIds = new Set(perspective.edgeIds);

  for (const edge of edges) {
    if (explicitEdgeIds.has(edge.id)) {
      visibleEdgeIds.add(edge.id);
      visibleNodeIds.add(edge.source);
      visibleNodeIds.add(edge.target);
      continue;
    }

    if (visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)) {
      visibleEdgeIds.add(edge.id);
    }
  }

  for (const nodeId of [...visibleNodeIds]) {
    let current = nodesById.get(nodeId);
    while (current?.parentId) {
      visibleNodeIds.add(current.parentId);
      current = nodesById.get(current.parentId);
    }
  }

  return {
    visibleNodeIds,
    visibleEdgeIds,
  };
}
