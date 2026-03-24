import type { ArchEdge, ArchNode, DiagramEdgeMetadata, DiagramLinkReference, DiagramNode, DiagramNodeMetadata } from "@/lib/types";
import { getShapeDef } from "@/lib/types";

export type DiagramQualitySeverity = "warning" | "info";
export type DiagramQualityCategory = "clarity" | "freshness" | "operability";

export interface DiagramQualityEntityRef {
  type: "node" | "edge";
  id: string;
  label: string;
}

export interface DiagramQualityIssue {
  id: string;
  severity: DiagramQualitySeverity;
  category: DiagramQualityCategory;
  title: string;
  description: string;
  entity?: DiagramQualityEntityRef;
}

export interface DiagramQuickLink {
  id: string;
  label: string;
  url: string;
  kind: DiagramLinkReference["kind"];
  groupLabel: string;
}

export interface DiagramQualitySummary {
  score: number;
  issues: DiagramQualityIssue[];
  warningCount: number;
  infoCount: number;
  staleNodeIds: string[];
  unclearEdgeIds: string[];
  staleNodeCount: number;
  disconnectedNodeCount: number;
  genericLabelCount: number;
  unlabeledEdgeCount: number;
  missingOwnerCount: number;
  missingOperationalLinkCount: number;
}

const STALE_AFTER_DAYS = 90;

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNodeLabel(node: DiagramNode): string {
  if (node.type === "textNode") return cleanText(node.data.text);
  return cleanText(node.data.label);
}

function getNodeMetadata(node: DiagramNode): DiagramNodeMetadata | undefined {
  if (node.type !== "archNode") return undefined;
  return node.data.metadata;
}

function getEdgeMetadata(edge: ArchEdge): DiagramEdgeMetadata | undefined {
  return edge.data?.metadata;
}

function getEdgeLabel(edge: ArchEdge): string {
  return cleanText(edge.data?.label ?? edge.label);
}

function getEdgeProtocol(edge: ArchEdge): string {
  return cleanText(getEdgeMetadata(edge)?.protocol ?? edge.data?.protocol);
}

function getEdgeRelationship(edge: ArchEdge): string {
  return cleanText(getEdgeMetadata(edge)?.relationshipType);
}

function getNodeDegree(nodeId: string, edges: ArchEdge[]): number {
  let degree = 0;
  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) degree += 1;
  }
  return degree;
}

function getNodeInOutDegree(nodeId: string, edges: ArchEdge[]): { inbound: number; outbound: number } {
  let inbound = 0;
  let outbound = 0;
  for (const edge of edges) {
    if (edge.source === nodeId) outbound += 1;
    if (edge.target === nodeId) inbound += 1;
  }
  return { inbound, outbound };
}

function isOperationalArchNode(node: ArchNode): boolean {
  return !["client", "cloud", "custom"].includes(node.data.shapeType);
}

function getOperationalLinkCount(metadata: DiagramNodeMetadata | undefined): number {
  if (!metadata) return 0;
  return (
    metadata.documentationLinks.length +
    metadata.dashboardLinks.length +
    metadata.logLinks.length +
    metadata.traceLinks.length +
    metadata.runbookLinks.length
  );
}

function isGenericNodeLabel(node: DiagramNode): boolean {
  const label = getNodeLabel(node).toLowerCase();
  if (!label) return true;

  if (node.type === "archNode") {
    return label === getShapeDef(node.data.shapeType).label.toLowerCase();
  }

  if (node.type === "databaseSchemaNode") return label === "new table";
  if (node.type === "groupNode") return label === "group";
  if (node.type === "textNode") return label === "text";
  return false;
}

function getNodeLastVerifiedAt(metadata: DiagramNodeMetadata | undefined): string | undefined {
  const raw = metadata?.lastVerifiedAt;
  return typeof raw === "string" && raw.trim() ? raw : undefined;
}

function isStale(isoDate: string | undefined, now: Date): boolean {
  if (!isoDate) return false;
  const value = Date.parse(isoDate);
  if (!Number.isFinite(value)) return false;
  return now.getTime() - value > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

function sortIssues(issues: DiagramQualityIssue[]): DiagramQualityIssue[] {
  const severityOrder: Record<DiagramQualitySeverity, number> = {
    warning: 0,
    info: 1,
  };
  const categoryOrder: Record<DiagramQualityCategory, number> = {
    clarity: 0,
    freshness: 1,
    operability: 2,
  };

  return [...issues].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      categoryOrder[a.category] - categoryOrder[b.category] ||
      a.title.localeCompare(b.title)
  );
}

export function collectNodeQuickLinks(node: ArchNode): DiagramQuickLink[] {
  const metadata = node.data.metadata;
  if (!metadata) return [];

  const groups: Array<{ label: string; links: DiagramLinkReference[] }> = [
    { label: "Documentation", links: metadata.documentationLinks },
    { label: "Dashboards", links: metadata.dashboardLinks },
    { label: "Logs", links: metadata.logLinks },
    { label: "Traces", links: metadata.traceLinks },
    { label: "Runbooks", links: metadata.runbookLinks },
  ];

  return groups.flatMap((group) =>
    group.links
      .filter((link) => cleanText(link.url))
      .map((link) => ({
        id: link.id,
        label: cleanText(link.label) || group.label,
        url: cleanText(link.url),
        kind: link.kind,
        groupLabel: group.label,
      }))
  );
}

export function collectEdgeQuickLinks(edge: ArchEdge): DiagramQuickLink[] {
  const metadata = getEdgeMetadata(edge);
  if (!metadata) return [];

  return metadata.evidenceReferences
    .filter((link) => cleanText(link.url))
    .map((link) => ({
      id: link.id,
      label: cleanText(link.label) || "Evidence",
      url: cleanText(link.url),
      kind: link.kind,
      groupLabel: "Evidence",
    }));
}

export function analyzeDiagramQuality(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  options?: { now?: Date }
): DiagramQualitySummary {
  const issues: DiagramQualityIssue[] = [];
  const now = options?.now ?? new Date();

  let staleNodeCount = 0;
  let disconnectedNodeCount = 0;
  let genericLabelCount = 0;
  let unlabeledEdgeCount = 0;
  let missingOwnerCount = 0;
  let missingOperationalLinkCount = 0;
  const staleNodeIds: string[] = [];
  const unclearEdgeIds: string[] = [];

  const actionableNodes = nodes.filter((node) => node.type !== "groupNode" && node.type !== "textNode");

  for (const node of nodes) {
    if (node.type === "groupNode" || node.type === "textNode") continue;

    const label = getNodeLabel(node);
    const entity: DiagramQualityEntityRef = {
      type: "node",
      id: node.id,
      label: label || node.id,
    };

    if (isGenericNodeLabel(node)) {
      genericLabelCount += 1;
      issues.push({
        id: `node-generic-label-${node.id}`,
        severity: "warning",
        category: "clarity",
        title: "Rename placeholder component labels",
        description: `${entity.label} still uses a generic label. Specific names make the diagram easier to trust and search.`,
        entity,
      });
    }

    if (actionableNodes.length > 1 && getNodeDegree(node.id, edges) === 0) {
      disconnectedNodeCount += 1;
      issues.push({
        id: `node-disconnected-${node.id}`,
        severity: "warning",
        category: "clarity",
        title: "Connect isolated components or move them to another view",
        description: `${entity.label} is disconnected from the rest of the diagram. If it belongs elsewhere, split the diagram into perspectives.`,
        entity,
      });
    }

    if (node.type === "archNode") {
      const metadata = getNodeMetadata(node);
      const owner = cleanText(metadata?.owner);
      const lastVerifiedAt = getNodeLastVerifiedAt(metadata);
      const operationalLinkCount = getOperationalLinkCount(metadata);
      const quickLinks = collectNodeQuickLinks(node);
      const { inbound, outbound } = getNodeInOutDegree(node.id, edges);

      if (isOperationalArchNode(node) && !owner) {
        missingOwnerCount += 1;
        issues.push({
          id: `node-owner-${node.id}`,
          severity: "warning",
          category: "operability",
          title: "Add an owner for operational components",
          description: `${entity.label} has no recorded owner. Ownership matters when incidents need escalation.`,
          entity,
        });
      }

      if (isOperationalArchNode(node) && operationalLinkCount === 0) {
        missingOperationalLinkCount += 1;
        issues.push({
          id: `node-links-${node.id}`,
          severity: "info",
          category: "operability",
          title: "Link components to docs, dashboards, logs, traces, or runbooks",
          description: `${entity.label} has no linked operational entry points yet. Turning the diagram into a starting point is one of the biggest usability wins.`,
          entity,
        });
      }

      if (isStale(lastVerifiedAt, now)) {
        staleNodeCount += 1;
        staleNodeIds.push(node.id);
        issues.push({
          id: `node-stale-${node.id}`,
          severity: "warning",
          category: "freshness",
          title: "Refresh stale component metadata",
          description: `${entity.label} has not been verified in more than ${STALE_AFTER_DAYS} days.`,
          entity,
        });
      }

      if (metadata && metadata.knownFailureModes.length > 0 && metadata.runbookLinks.length === 0) {
        issues.push({
          id: `node-runbook-${node.id}`,
          severity: "info",
          category: "operability",
          title: "Failure modes should point to recovery steps",
          description: `${entity.label} lists known failure modes but has no runbook link yet.`,
          entity,
        });
      }

      if (quickLinks.length > 10) {
        issues.push({
          id: `node-links-dense-${node.id}`,
          severity: "info",
          category: "clarity",
          title: "Too many links can hide the important ones",
          description: `${entity.label} has ${quickLinks.length} linked resources. Consider grouping them by perspective or surfacing only the key entry points.`,
          entity,
        });
      }

      if (outbound >= 5 || inbound >= 5) {
        issues.push({
          id: `node-fan-${node.id}`,
          severity: "info",
          category: "clarity",
          title: "Split heavily connected hotspots into focused views",
          description: `${entity.label} has ${outbound} outgoing and ${inbound} incoming dependencies. A single canvas may be doing too much here.`,
          entity,
        });
      }
    }
  }

  for (const edge of edges) {
    const label = getEdgeLabel(edge);
    const relationshipType = getEdgeRelationship(edge);
    const protocol = getEdgeProtocol(edge);
    const metadata = getEdgeMetadata(edge);
    const entity: DiagramQualityEntityRef = {
      type: "edge",
      id: edge.id,
      label: label || relationshipType || `${edge.source} -> ${edge.target}`,
    };

    if (!label && !relationshipType) {
      unlabeledEdgeCount += 1;
      unclearEdgeIds.push(edge.id);
      issues.push({
        id: `edge-meaning-${edge.id}`,
        severity: "warning",
        category: "clarity",
        title: "Give dependencies explicit meaning",
        description: `${entity.label} has no visible label or relationship type. Readers should know whether this edge means calls, reads, writes, publishes, or replicates.`,
        entity,
      });
    } else if (!label && relationshipType) {
      issues.push({
        id: `edge-surface-meaning-${edge.id}`,
        severity: "info",
        category: "clarity",
        title: "Surface relationship semantics on the canvas",
        description: `${entity.label} has a relationship type but no visible edge label. Short verb labels make the board easier to scan.`,
        entity,
      });
    }

    if (!protocol) {
      issues.push({
        id: `edge-protocol-${edge.id}`,
        severity: "info",
        category: "operability",
        title: "Record the protocol for important dependencies",
        description: `${entity.label} does not say whether it is HTTP, gRPC, SQL, Kafka, or something else.`,
        entity,
      });
    }

    if (protocol && /^(http|https|grpc|graphql)$/i.test(protocol) && !cleanText(metadata?.authAssumptions)) {
      issues.push({
        id: `edge-auth-${edge.id}`,
        severity: "info",
        category: "operability",
        title: "Document auth assumptions on request paths",
        description: `${entity.label} uses ${protocol} but does not describe auth or trust assumptions.`,
        entity,
      });
    }
  }

  if (actionableNodes.length >= 16 || edges.length >= 20) {
    issues.push({
      id: "diagram-density",
      severity: actionableNodes.length >= 24 || edges.length >= 32 ? "warning" : "info",
      category: "clarity",
      title: "Break large diagrams into saved perspectives",
      description: `This board has ${actionableNodes.length} active components and ${edges.length} dependencies. Consider audience-specific views for onboarding, operations, and security.`,
    });
  }

  const sortedIssues = sortIssues(issues);
  const warningCount = sortedIssues.filter((issue) => issue.severity === "warning").length;
  const infoCount = sortedIssues.length - warningCount;
  const score = Math.max(0, 100 - warningCount * 8 - infoCount * 3);

  return {
    score,
    issues: sortedIssues,
    warningCount,
    infoCount,
    staleNodeIds,
    unclearEdgeIds,
    staleNodeCount,
    disconnectedNodeCount,
    genericLabelCount,
    unlabeledEdgeCount,
    missingOwnerCount,
    missingOperationalLinkCount,
  };
}
