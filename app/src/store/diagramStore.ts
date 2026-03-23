import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  Position,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import type { ArchNode, ArchEdge, ShapeType, Diagram, DiagramNode, SchemaColumn, GroupNodeData, DatabaseSchemaNodeData, TextNodeData } from "@/lib/types";
import { getShapeDef } from "@/lib/types";
import { MermaidParseError, type MermaidDiagnostic, flowToMermaid, mermaidToFlow, type MermaidSubgraph } from "@/lib/converters";
import { autoLayout, type LayoutDirection } from "@/lib/layout";
import { saveDiagram, loadDiagram } from "@/lib/storage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;
let latestLoadRequest = 0;

type OverlapRect = { x: number; y: number; w: number; h: number };
type FlowPoint = { x: number; y: number };

type EdgeAttachMode = "ORIENTED" | "CLOSEST";

type DiagramHistorySnapshot = {
  nodes: DiagramNode[];
  edges: ArchEdge[];
  mermaidCode: string;
  layoutDirection: LayoutDirection;
};

type DiagramClipboardPayload = {
  version: 1;
  nodes: DiagramNode[];
  edges: ArchEdge[];
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function normalizeMermaidCode(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function needsMermaidReconcile(diagram: Diagram): boolean {
  const mermaid = diagram.mermaidCode ?? "";
  if (!mermaid.trim()) return false;
  if (diagram.nodes.length === 0 && diagram.edges.length === 0) return true;

  try {
    const generated = flowToMermaid(diagram.nodes, diagram.edges);
    return normalizeMermaidCode(generated) !== normalizeMermaidCode(mermaid);
  } catch {
    return true;
  }
}

function clipboardPayloadKey(payload: DiagramClipboardPayload): string {
  const nodeIds = payload.nodes.map((n) => n.id).join(",");
  const edgeIds = payload.edges.map((e) => e.id).join(",");
  return `v${payload.version}|n:${payload.nodes.length}:${nodeIds}|e:${payload.edges.length}:${edgeIds}`;
}

function stripGroupingFromNode(node: DiagramNode): DiagramNode {
  const { parentId, extent, expandParent, ...rest } = node as DiagramNode & {
    parentId?: string;
    extent?: unknown;
    expandParent?: unknown;
  };
  return rest as DiagramNode;
}

function stripRuntimeFieldsFromNode(node: DiagramNode): DiagramNode {
  const { selected, dragging, positionAbsolute, measured, ...rest } = node as DiagramNode & {
    selected?: boolean;
    dragging?: boolean;
    positionAbsolute?: unknown;
    measured?: unknown;
  };
  return rest as DiagramNode;
}

function stripRuntimeFieldsFromEdge(edge: ArchEdge): ArchEdge {
  const { selected, ...rest } = edge as ArchEdge & { selected?: boolean };
  return rest as ArchEdge;
}

function snapshotFromState(
  s: Pick<DiagramStore, "nodes" | "edges" | "mermaidCode" | "layoutDirection">
): DiagramHistorySnapshot {
  return {
    nodes: s.nodes.map(stripRuntimeFieldsFromNode),
    edges: s.edges.map(stripRuntimeFieldsFromEdge),
    mermaidCode: s.mermaidCode,
    layoutDirection: s.layoutDirection,
  };
}

function snapshotKey(snapshot: DiagramHistorySnapshot): string {
  const nodesKey = snapshot.nodes
    .map((n) => {
      const parent = (n as DiagramNode & { parentId?: string }).parentId ?? "";
      const x = Math.round(n.position?.x ?? 0);
      const y = Math.round(n.position?.y ?? 0);
      return `${n.id}:${parent}:${x}:${y}:${n.type ?? ""}`;
    })
    .join("|");

  const edgesKey = snapshot.edges
    .map((e) => {
      const label = (e.data?.label ?? e.label ?? "") as string;
      return `${e.id}:${e.source}->${e.target}:${e.type ?? ""}:${e.sourceHandle ?? ""}:${e.targetHandle ?? ""}:${label}`;
    })
    .join("|");

  return `${snapshot.layoutDirection}::${snapshot.mermaidCode.length}::n:${nodesKey}::e:${edgesKey}`;
}

function pushHistory(
  current: DiagramHistorySnapshot,
  past: DiagramHistorySnapshot[],
  next?: DiagramHistorySnapshot,
  options?: { max?: number }
): DiagramHistorySnapshot[] {
  const max = options?.max ?? 60;
  const nextKey = next ? snapshotKey(next) : "";
  const currentKey = snapshotKey(current);
  if (nextKey && nextKey === currentKey) return past;
  const last = past[past.length - 1];
  if (last && snapshotKey(last) === currentKey) return past;
  const out = [...past, current];
  return out.length > max ? out.slice(out.length - max) : out;
}

function buildChildrenByParentMap(nodes: DiagramNode[]): Map<string, DiagramNode[]> {
  const map = new Map<string, DiagramNode[]>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    const list = map.get(node.parentId) ?? [];
    list.push(node);
    map.set(node.parentId, list);
  }
  return map;
}

function collectDescendantIds(childrenByParent: Map<string, DiagramNode[]>, rootId: string): Set<string> {
  const result = new Set<string>();
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = childrenByParent.get(current) ?? [];
    for (const child of children) {
      if (result.has(child.id)) continue;
      result.add(child.id);
      stack.push(child.id);
    }
  }
  return result;
}

function sortNodesParentsFirst(nodes: DiagramNode[]): DiagramNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const out: DiagramNode[] = [];

  const visit = (nodeId: string) => {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) return;
    const node = byId.get(nodeId);
    if (!node) return;

    visiting.add(nodeId);
    if (node.parentId && byId.has(node.parentId)) {
      visit(node.parentId);
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    out.push(node);
  };

  for (const node of nodes) visit(node.id);
  return out;
}

function computeAbsolutePositionsWithinPayload(nodes: DiagramNode[]): Map<string, FlowPoint> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map<string, FlowPoint>();
  const visiting = new Set<string>();

  const getAbs = (nodeId: string): FlowPoint => {
    const cached = cache.get(nodeId);
    if (cached) return cached;

    const node = byId.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    if (!node.parentId || visiting.has(nodeId) || !byId.has(node.parentId)) {
      const abs = { x: node.position.x, y: node.position.y };
      cache.set(nodeId, abs);
      return abs;
    }

    visiting.add(nodeId);
    const parentAbs = getAbs(node.parentId);
    visiting.delete(nodeId);

    const abs = { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
    cache.set(nodeId, abs);
    return abs;
  };

  for (const node of nodes) getAbs(node.id);
  return cache;
}

function generateNodeId(node: DiagramNode): string {
  const suffix = uuidv4().slice(0, 8);
  if (node.type === "archNode") return `${(node.data as { shapeType?: string }).shapeType ?? "node"}_${suffix}`;
  if (node.type === "databaseSchemaNode") {
    const name = String((node.data as DatabaseSchemaNodeData).label ?? "table")
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]+/g, "");
    return `table_${name}_${suffix}`;
  }
  if (node.type === "groupNode") return `group_${suffix}`;
  if (node.type === "textNode") return `text_${suffix}`;
  return `node_${suffix}`;
}

function buildAbsolutePositionMap(nodes: DiagramNode[]): Map<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const cache = new Map<string, { x: number; y: number }>();
  const visiting = new Set<string>();

  function getAbs(nodeId: string): { x: number; y: number } {
    const cached = cache.get(nodeId);
    if (cached) return cached;

    const node = byId.get(nodeId);
    if (!node) return { x: 0, y: 0 };

    if (!node.parentId || visiting.has(nodeId)) {
      const abs = { x: node.position.x, y: node.position.y };
      cache.set(nodeId, abs);
      return abs;
    }

    visiting.add(nodeId);
    const parentAbs = getAbs(node.parentId);
    visiting.delete(nodeId);

    const abs = {
      x: parentAbs.x + node.position.x,
      y: parentAbs.y + node.position.y,
    };
    cache.set(nodeId, abs);
    return abs;
  }

  for (const node of nodes) {
    getAbs(node.id);
  }

  return cache;
}

function estimateNodeSizeForOverlap(node: DiagramNode): { w: number; h: number } {
  const measuredW = typeof node.measured?.width === "number" ? node.measured.width : undefined;
  const measuredH = typeof node.measured?.height === "number" ? node.measured.height : undefined;
  const explicitW = typeof node.width === "number" ? node.width : undefined;
  const explicitH = typeof node.height === "number" ? node.height : undefined;

  const width = explicitW ?? measuredW;
  const height = explicitH ?? measuredH;
  if (typeof width === "number" && typeof height === "number") {
    return { w: width, h: height };
  }

  if (node.type === "databaseSchemaNode") {
    const schema = (node.data as DatabaseSchemaNodeData).schema ?? [];
    return { w: 240, h: Math.max(80, 40 + schema.length * 24) };
  }

  if (node.type === "groupNode") {
    const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
    const w = typeof style.width === "number" && Number.isFinite(style.width) ? style.width : 400;
    const h = typeof style.height === "number" && Number.isFinite(style.height) ? style.height : 300;
    return { w, h };
  }

  if (node.type === "textNode") {
    const text = ((node.data as TextNodeData).text ?? "").trim();
    const lines = Math.max(1, text.split("\n").length);
    const longest = Math.max(4, ...text.split("\n").map((l) => l.length));
    const w = Math.min(420, Math.max(80, 8 * longest + 16));
    const h = Math.max(32, 22 * lines + 12);
    return { w, h };
  }

  const shapeDef = getShapeDef((node as ArchNode).data.shapeType);
  return { w: shapeDef.defaultWidth, h: shapeDef.defaultHeight };
}

function rectsOverlap(a: OverlapRect, b: OverlapRect, padding = 0): boolean {
  const ax1 = a.x - padding;
  const ay1 = a.y - padding;
  const ax2 = a.x + a.w + padding;
  const ay2 = a.y + a.h + padding;

  const bx1 = b.x - padding;
  const by1 = b.y - padding;
  const bx2 = b.x + b.w + padding;
  const by2 = b.y + b.h + padding;

  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
}

function snapToGrid(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

function findNonOverlappingAbsPosition(
  desiredAbs: { x: number; y: number },
  size: { w: number; h: number },
  obstacles: OverlapRect[],
  options?: { grid?: number; padding?: number; maxRadiusSteps?: number }
): { x: number; y: number } {
  const grid = options?.grid ?? 20;
  const padding = options?.padding ?? 12;
  const maxRadiusSteps = options?.maxRadiusSteps ?? 30;

  const isFreeAt = (x: number, y: number) => {
    const candidate: OverlapRect = { x, y, w: size.w, h: size.h };
    return !obstacles.some((o) => rectsOverlap(candidate, o, padding));
  };

  // Preserve exact placement if it doesn't collide.
  if (isFreeAt(desiredAbs.x, desiredAbs.y)) return desiredAbs;

  const startX = snapToGrid(desiredAbs.x, grid);
  const startY = snapToGrid(desiredAbs.y, grid);
  if (isFreeAt(startX, startY)) return { x: startX, y: startY };

  for (let r = 1; r <= maxRadiusSteps; r++) {
    // Top/bottom edges of the ring
    for (let dx = -r; dx <= r; dx++) {
      const x = startX + dx * grid;
      const yTop = startY - r * grid;
      if (isFreeAt(x, yTop)) return { x, y: yTop };

      const yBottom = startY + r * grid;
      if (isFreeAt(x, yBottom)) return { x, y: yBottom };
    }

    // Left/right edges of the ring (excluding corners already checked)
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      const y = startY + dy * grid;
      const xLeft = startX - r * grid;
      if (isFreeAt(xLeft, y)) return { x: xLeft, y };

      const xRight = startX + r * grid;
      if (isFreeAt(xRight, y)) return { x: xRight, y };
    }
  }

  return desiredAbs;
}

function packRootNodesToAvoidOverlaps(nodes: DiagramNode[]): DiagramNode[] {
  const rootNodes = nodes.filter((n) => !n.parentId);
  if (rootNodes.length <= 1) return nodes;

  const sorted = [...rootNodes].sort((a, b) => {
    const ax = a.position?.x ?? 0;
    const bx = b.position?.x ?? 0;
    if (ax !== bx) return ax - bx;
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    return ay - by;
  });

  const obstacles: OverlapRect[] = [];
  const packedById = new Map<string, { x: number; y: number }>();

  for (const node of sorted) {
    const desired = node.position ?? { x: 0, y: 0 };
    const { w, h } = estimateNodeSizeForOverlap(node);
    const free = findNonOverlappingAbsPosition(desired, { w, h }, obstacles, {
      grid: 20,
      padding: 28,
      maxRadiusSteps: 80,
    });
    packedById.set(node.id, free);
    obstacles.push({ x: free.x, y: free.y, w, h });
  }

  return nodes.map((n) => {
    if (n.parentId) return n;
    const pos = packedById.get(n.id);
    if (!pos) return n;
    return { ...n, position: pos };
  });
}

function applyEdgePositions(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection,
  mode: EdgeAttachMode
): ArchEdge[] {
  const absPosMap = buildAbsolutePositionMap(nodes);
  const byId = new Map(nodes.map((n) => [n.id, n]));

  const oriented =
    direction === "DOWN"
      ? { sourcePosition: Position.Bottom, targetPosition: Position.Top }
      : { sourcePosition: Position.Right, targetPosition: Position.Left };

  const supportsHandles = (nodeId: string) => {
    const n = byId.get(nodeId);
    return n?.type === "archNode" || n?.type === "databaseSchemaNode";
  };

  if (mode === "ORIENTED") {
    if (direction === "DOWN") {
      return edges.map((e) => ({
        ...e,
        ...oriented,
        ...(supportsHandles(e.source) ? { sourceHandle: "bottom" } : {}),
        ...(supportsHandles(e.target) ? { targetHandle: "t-top" } : {}),
      }));
    }
    return edges.map((e) => ({
      ...e,
      ...oriented,
      ...(supportsHandles(e.source) ? { sourceHandle: "right" } : {}),
      ...(supportsHandles(e.target) ? { targetHandle: "t-left" } : {}),
    }));
  }

  const getCenter = (nodeId: string): FlowPoint | null => {
    const node = byId.get(nodeId);
    if (!node) return null;
    const abs = absPosMap.get(nodeId);
    if (!abs) return null;
    const { w, h } = estimateNodeSizeForOverlap(node);
    return { x: abs.x + w / 2, y: abs.y + h / 2 };
  };

  return edges.map((edge) => {
    const sourceCenter = getCenter(edge.source);
    const targetCenter = getCenter(edge.target);
    if (!sourceCenter || !targetCenter) return { ...edge, ...oriented };

    const dx = targetCenter.x - sourceCenter.x;
    const dy = targetCenter.y - sourceCenter.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);

    if (horizontal) {
      const leftToRight = dx >= 0;
      return {
        ...edge,
        sourcePosition: leftToRight ? Position.Right : Position.Left,
        targetPosition: leftToRight ? Position.Left : Position.Right,
        ...(supportsHandles(edge.source)
          ? { sourceHandle: leftToRight ? "right" : "left" }
          : {}),
        ...(supportsHandles(edge.target)
          ? { targetHandle: leftToRight ? "t-left" : "t-right" }
          : {}),
      };
    }

    const topToBottom = dy >= 0;
    return {
      ...edge,
      sourcePosition: topToBottom ? Position.Bottom : Position.Top,
      targetPosition: topToBottom ? Position.Top : Position.Bottom,
      ...(supportsHandles(edge.source)
        ? { sourceHandle: topToBottom ? "bottom" : "top" }
        : {}),
      ...(supportsHandles(edge.target)
        ? { targetHandle: topToBottom ? "t-top" : "t-bottom" }
        : {}),
    };
  });
}

type GroupTemplate = {
  data?: GroupNodeData;
  style?: DiagramNode["style"];
};

function extractExistingGroupSubgraphs(nodes: DiagramNode[]): {
  subgraphs: MermaidSubgraph[];
  templates: Map<string, GroupTemplate>;
} {
  const groups = nodes.filter((n) => n.type === "groupNode");
  const byId = new Map(groups.map((g) => [g.id, g]));
  const indexById = new Map(nodes.map((n, idx) => [n.id, idx]));
  const templates = new Map<string, GroupTemplate>();

  for (const group of groups) {
    templates.set(group.id, {
      data: { ...(group.data as GroupNodeData) },
      style: group.style,
    });
  }

  const directLeafChildren = new Map<string, string[]>();
  for (const group of groups) {
    directLeafChildren.set(group.id, []);
  }

  for (const node of nodes) {
    if (!node.parentId) continue;
    if (!byId.has(node.parentId)) continue;
    if (node.type === "groupNode") continue;
    directLeafChildren.get(node.parentId)?.push(node.id);
  }

  const depthCache = new Map<string, number>();
  const visiting = new Set<string>();
  const getDepth = (groupId: string): number => {
    const cached = depthCache.get(groupId);
    if (cached != null) return cached;
    const group = byId.get(groupId);
    if (!group) return 0;
    const parentId = group.parentId && byId.has(group.parentId) ? group.parentId : null;
    if (!parentId || visiting.has(groupId)) {
      depthCache.set(groupId, 0);
      return 0;
    }
    visiting.add(groupId);
    const depth = getDepth(parentId) + 1;
    visiting.delete(groupId);
    depthCache.set(groupId, depth);
    return depth;
  };

  const subgraphs: MermaidSubgraph[] = groups
    .map((group) => {
      const parentKey = group.parentId && byId.has(group.parentId) ? group.parentId : null;
      return {
        key: group.id,
        id: group.id,
        label: String((group.data as GroupNodeData).label ?? "Group"),
        parentKey,
        depth: getDepth(group.id),
        order: indexById.get(group.id) ?? 0,
        nodeIds: directLeafChildren.get(group.id) ?? [],
      } satisfies MermaidSubgraph;
    })
    .sort((a, b) => a.order - b.order);

  return { subgraphs, templates };
}

function applyMermaidSubgraphGroups(
  nodes: DiagramNode[],
  subgraphs: MermaidSubgraph[],
  options?: {
    preserveGroupIds?: boolean;
    groupTemplates?: Map<string, GroupTemplate>;
  }
): DiagramNode[] {
  if (subgraphs.length === 0) return nodes.map(stripGroupingFromNode);

  const baseNodes = nodes.map(stripGroupingFromNode).filter((n) => n.type !== "groupNode");
  const nodeMap = new Map(baseNodes.map((n) => [n.id, { ...n } as DiagramNode]));
  const subByKey = new Map(subgraphs.map((sg) => [sg.key, sg]));
  const childSubgraphsByParent = new Map<string | null, MermaidSubgraph[]>();

  for (const sg of subgraphs) {
    const arr = childSubgraphsByParent.get(sg.parentKey) ?? [];
    arr.push(sg);
    childSubgraphsByParent.set(sg.parentKey, arr);
  }
  for (const arr of childSubgraphsByParent.values()) {
    arr.sort((a, b) => a.order - b.order);
  }

  const GROUP_PADDING = 28;
  const GROUP_LABEL_HEIGHT = 24;
  const DEFAULT_GROUP_W = 280;
  const DEFAULT_GROUP_H = 180;

  type Rect = { x: number; y: number; w: number; h: number };
  const groupNodeByKey = new Map<string, DiagramNode>();

  function numericSize(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }

  function estimateNodeSize(node: DiagramNode): { w: number; h: number } {
    const measuredW = typeof node.measured?.width === "number" ? node.measured.width : undefined;
    const measuredH = typeof node.measured?.height === "number" ? node.measured.height : undefined;
    const width = typeof node.width === "number" ? node.width : measuredW;
    const height = typeof node.height === "number" ? node.height : measuredH;
    if (typeof width === "number" && typeof height === "number") {
      return { w: width, h: height };
    }

    if (node.type === "databaseSchemaNode") {
      const schema = (node.data as DatabaseSchemaNodeData).schema ?? [];
      return { w: 240, h: Math.max(80, 40 + schema.length * 24) };
    }
    if (node.type === "groupNode") {
      const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
      return {
        w: numericSize(style?.width, DEFAULT_GROUP_W),
        h: numericSize(style?.height, DEFAULT_GROUP_H),
      };
    }

    const shapeDef = getShapeDef((node as ArchNode).data.shapeType);
    return { w: shapeDef.defaultWidth, h: shapeDef.defaultHeight };
  }

  function nodeRect(node: DiagramNode): Rect {
    const { w, h } = estimateNodeSize(node);
    return { x: node.position.x, y: node.position.y, w, h };
  }

  function groupIdForSubgraph(sg: MermaidSubgraph): string {
    if (options?.preserveGroupIds) return sg.id;
    return `group_mermaid_${sg.key}`;
  }

  function buildGroupNode(sg: MermaidSubgraph): DiagramNode {
    const existingBuilt = groupNodeByKey.get(sg.key);
    if (existingBuilt) return existingBuilt;

    const childRects: Rect[] = [];
    for (const childKey of (childSubgraphsByParent.get(sg.key) ?? []).map((x) => x.key)) {
      const childGroup = buildGroupNode(subByKey.get(childKey)!);
      childRects.push(nodeRect(childGroup));
    }
    for (const nodeId of sg.nodeIds) {
      const node = nodeMap.get(nodeId);
      if (node) childRects.push(nodeRect(node));
    }

    let x = 0;
    let y = 0;
    let w = DEFAULT_GROUP_W;
    let h = DEFAULT_GROUP_H;
    if (childRects.length > 0) {
      const minX = Math.min(...childRects.map((r) => r.x));
      const minY = Math.min(...childRects.map((r) => r.y));
      const maxX = Math.max(...childRects.map((r) => r.x + r.w));
      const maxY = Math.max(...childRects.map((r) => r.y + r.h));
      x = minX - GROUP_PADDING;
      y = minY - GROUP_PADDING - GROUP_LABEL_HEIGHT;
      w = Math.max(DEFAULT_GROUP_W, maxX - minX + GROUP_PADDING * 2);
      h = Math.max(DEFAULT_GROUP_H, maxY - minY + GROUP_PADDING * 2 + GROUP_LABEL_HEIGHT);
    }

    const groupNode: DiagramNode = {
      id: groupIdForSubgraph(sg),
      type: "groupNode",
      position: { x, y },
      data: {
        ...(options?.groupTemplates?.get(groupIdForSubgraph(sg))?.data ?? {}),
        label: sg.label,
      } as GroupNodeData,
      style: {
        ...(options?.groupTemplates?.get(groupIdForSubgraph(sg))?.style as object ?? {}),
        width: w,
        height: h,
      },
    };
    groupNodeByKey.set(sg.key, groupNode);
    return groupNode;
  }

  for (const root of childSubgraphsByParent.get(null) ?? []) {
    buildGroupNode(root);
  }

  function reparentNodeToGroup(child: DiagramNode, parent: DiagramNode): DiagramNode {
    const relX = child.position.x - parent.position.x;
    const relY = child.position.y - parent.position.y;
    return {
      ...child,
      parentId: parent.id,
      extent: "parent" as const,
      expandParent: true,
      position: { x: relX, y: relY },
    } as DiagramNode;
  }

  const sortedByDepthDesc = [...subgraphs].sort((a, b) => b.depth - a.depth || a.order - b.order);

  for (const sg of sortedByDepthDesc) {
    const groupNode = groupNodeByKey.get(sg.key);
    if (!groupNode) continue;

    for (const nodeId of sg.nodeIds) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;
      nodeMap.set(nodeId, reparentNodeToGroup(node, groupNode));
    }

    if (sg.parentKey) {
      const parentGroup = groupNodeByKey.get(sg.parentKey);
      if (parentGroup) {
        groupNodeByKey.set(sg.key, reparentNodeToGroup(groupNode, parentGroup));
      }
    }
  }

  const groupOrder = new Map<string, { depth: number; order: number }>();
  for (const sg of subgraphs) {
    groupOrder.set(groupIdForSubgraph(sg), { depth: sg.depth, order: sg.order });
  }

  const groups = [...groupNodeByKey.values()].sort((a, b) => {
    const ma = groupOrder.get(a.id) ?? { depth: 0, order: 0 };
    const mb = groupOrder.get(b.id) ?? { depth: 0, order: 0 };
    return ma.depth - mb.depth || ma.order - mb.order;
  });

  const nonGroups = baseNodes.map((n) => nodeMap.get(n.id) ?? n);
  return [...groups, ...nonGroups];
}

interface DiagramStore {
  // Current diagram metadata
  diagramId: string;
  diagramName: string;
  diagramDescription: string;
  diagramRevision: number;
  isLoading: boolean;
  loadError: string | null;
  loadWarnings: string[];
  persistError: string | null;
  mermaidError: string | null;
  mermaidDiagnostics: MermaidDiagnostic[];

  // Graph state
  nodes: DiagramNode[];
  edges: ArchEdge[];
  mermaidCode: string;
  layoutDirection: LayoutDirection;

  // Undo/redo
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Clipboard
  clipboard: DiagramClipboardPayload | null;
  clipboardKey: string | null;
  clipboardPasteIndex: number;

  // Sync direction guard
  _syncingFromMermaid: boolean;
  _syncingFromFlow: boolean;
  _applyingHistory: boolean;
  _historyPast: DiagramHistorySnapshot[];
  _historyFuture: DiagramHistorySnapshot[];

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  loadDiagram: (id: string) => Promise<boolean>;
  initNewDiagram: (name: string, description?: string) => Promise<string>;
  setDiagramMeta: (name: string, description: string) => void;
  persist: () => void;

  addNode: (shapeType: ShapeType, position?: { x: number; y: number }) => void;
  addDatabaseSchemaNode: (tableName: string, columns: SchemaColumn[], position?: { x: number; y: number }) => void;
  addGroupNode: (label?: string, position?: { x: number; y: number }) => void;
  addTextNode: (text?: string, position?: { x: number; y: number }) => void;
  copySelected: () => DiagramClipboardPayload | null;
  cutSelected: () => DiagramClipboardPayload | null;
  pasteClipboard: (position?: FlowPoint, payload?: DiagramClipboardPayload) => void;
  groupSelectedNodes: () => void;
  ungroupSelectedNodes: () => void;
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  sendToFront: () => void;
  sendToBack: () => void;
  sendForward: () => void;
  sendBackward: () => void;
  deleteSelected: () => void;
  updateNodeData: (nodeId: string, data: Partial<ArchNode["data"]>) => void;
  updateEdge: (edgeId: string, updates: Partial<ArchEdge>) => void;

  updateMermaidCode: (code: string) => void;
  syncFlowToMermaid: () => void;
  syncMermaidToFlow: () => Promise<void>;

  runAutoLayout: (direction?: LayoutDirection, edgeAttachMode?: EdgeAttachMode) => Promise<void>;
  setNodesAndEdges: (nodes: DiagramNode[], edges: ArchEdge[]) => void;
  resolveOverlapsForNode: (nodeId: string) => void;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  diagramId: "",
  diagramName: "Untitled Diagram",
  diagramDescription: "",
  diagramRevision: 0,
  isLoading: false,
  loadError: null,
  loadWarnings: [],
  persistError: null,
  mermaidError: null,
  mermaidDiagnostics: [],
  nodes: [],
  edges: [],
  mermaidCode: "graph TD\n",
  layoutDirection: "RIGHT",
  canUndo: false,
  canRedo: false,
  undo: () => {
    const s = get();
    if (s._applyingHistory || s._historyPast.length === 0) return;
    const prev = s._historyPast[s._historyPast.length - 1];
    const current = snapshotFromState(s);
    set({
      _applyingHistory: true,
      nodes: prev.nodes,
      edges: prev.edges,
      mermaidCode: prev.mermaidCode,
      layoutDirection: prev.layoutDirection,
      _historyPast: s._historyPast.slice(0, -1),
      _historyFuture: [current, ...s._historyFuture],
    });
    set((ss) => ({
      canUndo: ss._historyPast.length > 0,
      canRedo: ss._historyFuture.length > 0,
      _applyingHistory: false,
    }));
  },
  redo: () => {
    const s = get();
    if (s._applyingHistory || s._historyFuture.length === 0) return;
    const next = s._historyFuture[0];
    const current = snapshotFromState(s);
    set({
      _applyingHistory: true,
      nodes: next.nodes,
      edges: next.edges,
      mermaidCode: next.mermaidCode,
      layoutDirection: next.layoutDirection,
      _historyPast: [...s._historyPast, current],
      _historyFuture: s._historyFuture.slice(1),
    });
    set((ss) => ({
      canUndo: ss._historyPast.length > 0,
      canRedo: ss._historyFuture.length > 0,
      _applyingHistory: false,
    }));
  },
  clipboard: null,
  clipboardKey: null,
  clipboardPasteIndex: 0,
  _syncingFromMermaid: false,
  _syncingFromFlow: false,
  _applyingHistory: false,
  _historyPast: [],
  _historyFuture: [],

  onNodesChange: (changes) => {
    set((s) => {
      const newNodes = applyNodeChanges(changes, s.nodes) as DiagramNode[];

      if (s._applyingHistory || s._syncingFromMermaid) {
        return { nodes: newNodes };
      }

      const hasAnyNonPositionChange = changes.some(
        (c) => c.type !== "position" && c.type !== "select"
      );
      const hasFinalPositionChange = changes.some(
        (c) => c.type === "position" && (c as { dragging?: boolean }).dragging === false
      );

      // Only record drag moves once (when dragging ends), but do record structural changes.
      if (!hasAnyNonPositionChange && !hasFinalPositionChange) {
        return { nodes: newNodes };
      }

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: newNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: newNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    // Debounced sync to mermaid after node changes (positions don't affect mermaid)
    const hasStructuralChange = changes.some(
      (c) => c.type === "add" || c.type === "remove"
    );
    if (hasStructuralChange && !get()._syncingFromMermaid) {
      get().syncFlowToMermaid();
    }
  },

  onEdgesChange: (changes) => {
    set((s) => {
      const newEdges = applyEdgeChanges(changes, s.edges) as ArchEdge[];
      if (s._applyingHistory || s._syncingFromMermaid) {
        return { edges: newEdges };
      }

      const hasMeaningfulChange = changes.some((c) => c.type !== "select");
      if (!hasMeaningfulChange) return { edges: newEdges };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        edges: newEdges.map(stripRuntimeFieldsFromEdge),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        edges: newEdges,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    if (!get()._syncingFromMermaid) {
      get().syncFlowToMermaid();
    }
  },

  onConnect: (connection) => {
    const dir = get().layoutDirection;
    const base: ArchEdge = {
      id: uuidv4(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      type: "smoothstep",
      animated: false,
      markerEnd: { type: "arrowclosed", width: 16, height: 16 },
    };
    const [patched] = applyEdgePositions(get().nodes, [base], dir, "CLOSEST");
    set((s) => {
      const nextEdges = addEdge({ ...connection, ...patched }, s.edges) as ArchEdge[];
      if (s._applyingHistory || s._syncingFromMermaid) {
        return { edges: nextEdges };
      }
      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        edges: nextEdges.map(stripRuntimeFieldsFromEdge),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        edges: nextEdges,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    if (!get()._syncingFromMermaid) {
      get().syncFlowToMermaid();
    }
  },

  loadDiagram: async (id: string) => {
    const requestId = ++latestLoadRequest;
    set({
      diagramId: "",
      diagramName: "Untitled Diagram",
      diagramDescription: "",
      diagramRevision: 0,
      isLoading: true,
      loadError: null,
      loadWarnings: [],
      persistError: null,
      mermaidError: null,
      mermaidDiagnostics: [],
      nodes: [],
      edges: [],
      mermaidCode: "graph TD\n",
      layoutDirection: "RIGHT",
      _syncingFromMermaid: false,
      _syncingFromFlow: false,
      _applyingHistory: false,
      _historyPast: [],
      _historyFuture: [],
      canUndo: false,
      canRedo: false,
    });

    try {
      const diagram = await loadDiagram(id);
      if (requestId !== latestLoadRequest) return false;
      if (!diagram) {
        set({
          isLoading: false,
          loadError: "Diagram not found",
        });
        return false;
      }

      const shouldReconcile = needsMermaidReconcile(diagram);
      set({
        diagramId: diagram.id,
        diagramName: diagram.name,
        diagramDescription: diagram.description,
        diagramRevision: diagram.revision,
        isLoading: shouldReconcile,
        loadError: null,
        loadWarnings: diagram.warnings ?? [],
        persistError: null,
        mermaidError: null,
        mermaidDiagnostics: [],
        nodes: diagram.nodes as DiagramNode[],
        edges: diagram.edges as ArchEdge[],
        mermaidCode: diagram.mermaidCode,
        layoutDirection: "RIGHT",
        _historyPast: [],
        _historyFuture: [],
        canUndo: false,
        canRedo: false,
      });

      if (!shouldReconcile) {
        return true;
      }

      set({ _applyingHistory: true });
      try {
        await get().syncMermaidToFlow();
      } finally {
        if (requestId === latestLoadRequest) {
          set({ _applyingHistory: false, isLoading: false });
        }
      }

      return true;
    } catch (error) {
      if (requestId !== latestLoadRequest) return false;
      const message = getErrorMessage(error, "Failed to load diagram");
      console.error("Failed to load diagram", error);
      set({
        diagramId: "",
        diagramName: "Untitled Diagram",
        diagramDescription: "",
        diagramRevision: 0,
        isLoading: false,
        loadError: message,
        loadWarnings: [],
        nodes: [],
        edges: [],
        mermaidCode: "graph TD\n",
        layoutDirection: "RIGHT",
        _historyPast: [],
        _historyFuture: [],
        canUndo: false,
        canRedo: false,
      });
      return false;
    }
  },

  initNewDiagram: async (name: string, description?: string) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const diagram: Diagram = {
      id,
      name,
      description: description ?? "",
      projectId: null,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      nodeCount: 0,
      edgeCount: 0,
      sessionCount: 0,
      openSessionCount: 0,
      nodes: [],
      edges: [],
      mermaidCode: "graph TD\n",
    };
    try {
      const saved = await saveDiagram(diagram);
      set({
        diagramRevision: saved.revision,
        loadWarnings: saved.warnings ?? [],
      });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create diagram");
      set({ persistError: message });
      throw error;
    }
    set({
      diagramId: id,
      diagramName: name,
      diagramDescription: description ?? "",
      diagramRevision: 1,
      isLoading: false,
      loadError: null,
      loadWarnings: [],
      persistError: null,
      mermaidError: null,
      mermaidDiagnostics: [],
      nodes: [],
      edges: [],
      mermaidCode: "graph TD\n",
      layoutDirection: "RIGHT",
      _historyPast: [],
      _historyFuture: [],
      canUndo: false,
      canRedo: false,
    });
    return id;
  },

  setDiagramMeta: (name, description) => {
    set({ diagramName: name, diagramDescription: description, persistError: null });
    get().persist();
  },

  persist: () => {
    const s = get();
    if (!s.diagramId || s.isLoading) return;
    if (s.mermaidError) {
      set({ persistError: "Resolve Mermaid errors before saving this diagram." });
      return;
    }
    set({ persistError: null });

    const requestId = ++latestPersistRequest;
    const snapshot = {
      diagramId: s.diagramId,
      diagramName: s.diagramName,
      diagramDescription: s.diagramDescription,
      diagramRevision: s.diagramRevision,
      nodes: s.nodes,
      edges: s.edges,
      mermaidCode: s.mermaidCode,
    };

    // Serialize writes and skip stale snapshots so an older async save
    // cannot overwrite a newer state.
    persistQueue = persistQueue
      .catch(() => undefined)
      .then(async () => {
        if (requestId !== latestPersistRequest) return;

        const existing = await loadDiagram(snapshot.diagramId);
        if (requestId !== latestPersistRequest) return;

        const diagram: Diagram & { expectedRevision?: number } = {
          id: snapshot.diagramId,
          name: snapshot.diagramName,
          description: snapshot.diagramDescription,
          projectId: existing?.projectId ?? null,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          revision: existing?.revision ?? snapshot.diagramRevision,
          nodeCount: snapshot.nodes.length,
          edgeCount: snapshot.edges.length,
          sessionCount: existing?.sessionCount ?? 0,
          openSessionCount: existing?.openSessionCount ?? 0,
          expectedRevision: snapshot.diagramRevision || existing?.revision,
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          mermaidCode: snapshot.mermaidCode,
        };

        const saved = await saveDiagram(diagram);
        if (requestId !== latestPersistRequest) return;
        set((curr) => {
          if (curr.diagramId !== snapshot.diagramId) return {};
          return {
            diagramRevision: saved.revision,
            loadWarnings: saved.warnings ?? [],
            persistError: null,
          };
        });
      })
      .catch((error) => {
        const message = getErrorMessage(error, "Failed to save diagram");
        console.error("Failed to persist diagram", error);
        set((curr) => {
          if (curr.diagramId !== snapshot.diagramId) return {};
          return { persistError: message };
        });
      });
  },

  addNode: (shapeType, position) => {
    const shapeDef = getShapeDef(shapeType);
    const id = `${shapeType}_${uuidv4().slice(0, 8)}`;
    const desiredPos = position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    const baseNode: ArchNode = {
      id,
      type: "archNode",
      position: desiredPos,
      data: {
        label: shapeDef.label,
        shapeType,
        description: "",
      },
    };
    set((s) => {
      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const obstacles = s.nodes
        .filter((n) => n.type !== "groupNode" && !n.parentId)
        .map((n) => {
          const abs = absPosMap.get(n.id);
          if (!abs) return null;
          const { w, h } = estimateNodeSizeForOverlap(n);
          return { x: abs.x, y: abs.y, w, h } satisfies OverlapRect;
        })
        .filter((x): x is OverlapRect => Boolean(x));

      const { w, h } = estimateNodeSizeForOverlap(baseNode);
      const freeAbs = findNonOverlappingAbsPosition(baseNode.position, { w, h }, obstacles);
      const nextNodes = [...s.nodes, { ...baseNode, position: freeAbs }];
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes: nextNodes };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  addDatabaseSchemaNode: (tableName, columns, position) => {
    const id = `table_${tableName.toLowerCase().replace(/\s+/g, "_")}_${uuidv4().slice(0, 8)}`;
    const desiredPos = position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    const baseNode: DiagramNode = {
      id,
      type: "databaseSchemaNode",
      position: desiredPos,
      data: {
        label: tableName,
        schema: columns,
      },
    };
    set((s) => {
      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const obstacles = s.nodes
        .filter((n) => n.type !== "groupNode" && !n.parentId)
        .map((n) => {
          const abs = absPosMap.get(n.id);
          if (!abs) return null;
          const { w, h } = estimateNodeSizeForOverlap(n);
          return { x: abs.x, y: abs.y, w, h } satisfies OverlapRect;
        })
        .filter((x): x is OverlapRect => Boolean(x));

      const { w, h } = estimateNodeSizeForOverlap(baseNode);
      const freeAbs = findNonOverlappingAbsPosition(baseNode.position, { w, h }, obstacles);
      const nextNodes = [...s.nodes, { ...baseNode, position: freeAbs }];
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes: nextNodes };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  addGroupNode: (label, position) => {
    const id = `group_${uuidv4().slice(0, 8)}`;
    const newNode: DiagramNode = {
      id,
      type: "groupNode",
      position: position ?? { x: Math.random() * 400 + 50, y: Math.random() * 300 + 50 },
      data: {
        label: label ?? "Group",
      } as GroupNodeData,
      style: { width: 400, height: 300 },
    };
    set((s) => {
      const nextNodes = [...s.nodes, newNode];
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes: nextNodes };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
  },

  addTextNode: (text, position) => {
    const id = `text_${uuidv4().slice(0, 8)}`;
    const desiredPos = position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 };
    const baseNode: DiagramNode = {
      id,
      type: "textNode",
      position: desiredPos,
      data: {
        text: text ?? "Text",
        fontSize: 16,
      } satisfies TextNodeData,
    };

    set((s) => {
      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const obstacles = s.nodes
        .filter((n) => n.type !== "groupNode" && !n.parentId)
        .map((n) => {
          const abs = absPosMap.get(n.id);
          if (!abs) return null;
          const { w, h } = estimateNodeSizeForOverlap(n);
          return { x: abs.x, y: abs.y, w, h } satisfies OverlapRect;
        })
        .filter((x): x is OverlapRect => Boolean(x));

      const { w, h } = estimateNodeSizeForOverlap(baseNode);
      const freeAbs = findNonOverlappingAbsPosition(baseNode.position, { w, h }, obstacles);
      const nextNodes = [...s.nodes, { ...baseNode, position: freeAbs }];
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes: nextNodes };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
  },

  copySelected: () => {
    const s = get();
    const absPosMap = buildAbsolutePositionMap(s.nodes);
    const childrenByParent = buildChildrenByParentMap(s.nodes);

    const explicitlySelected = s.nodes.filter((n) => n.selected);
    if (explicitlySelected.length === 0 && s.edges.every((e) => !e.selected)) return null;

    const selectedIds = new Set(explicitlySelected.map((n) => n.id));

    // If only edges are selected, include their endpoints.
    for (const edge of s.edges.filter((e) => e.selected)) {
      selectedIds.add(edge.source);
      selectedIds.add(edge.target);
    }

    // If a group is selected, include all descendants.
    for (const group of explicitlySelected.filter((n) => n.type === "groupNode")) {
      const descendants = collectDescendantIds(childrenByParent, group.id);
      for (const id of descendants) selectedIds.add(id);
    }

    const includedNodes = s.nodes.filter((n) => selectedIds.has(n.id));
    const includedIdSet = new Set(includedNodes.map((n) => n.id));

    const normalizedNodes: DiagramNode[] = includedNodes.map((node) => {
      const abs = absPosMap.get(node.id) ?? node.position;
      const runtimeStripped = stripRuntimeFieldsFromNode(node);

      if (node.parentId && !includedIdSet.has(node.parentId)) {
        const { parentId, extent, expandParent, ...rest } = runtimeStripped as DiagramNode & { extent?: unknown; expandParent?: unknown };
        return { ...rest, position: abs } as DiagramNode;
      }

      return runtimeStripped;
    });

    const normalizedIdSet = new Set(normalizedNodes.map((n) => n.id));
    const edgesToCopy = s.edges
      .filter((e) => normalizedIdSet.has(e.source) && normalizedIdSet.has(e.target))
      .filter((e, idx, arr) => arr.findIndex((x) => x.id === e.id) === idx)
      .map(stripRuntimeFieldsFromEdge);

    const payload: DiagramClipboardPayload = {
      version: 1,
      nodes: normalizedNodes,
      edges: edgesToCopy,
    };

    set({ clipboard: payload, clipboardKey: clipboardPayloadKey(payload), clipboardPasteIndex: 0 });
    return payload;
  },

  cutSelected: () => {
    const payload = get().copySelected();
    if (!payload) return null;
    get().deleteSelected();
    return payload;
  },

  pasteClipboard: (position, payload) => {
    set((s) => {
      const sourcePayload = payload ?? s.clipboard;
      if (!sourcePayload || sourcePayload.nodes.length === 0) return s;

      const incomingKey = payload ? clipboardPayloadKey(sourcePayload) : null;
      const isSameClipboard = Boolean(payload && incomingKey && incomingKey === s.clipboardKey);
      const effectivePasteIndex = payload && !isSameClipboard ? 0 : s.clipboardPasteIndex;
      const pasteStep = 24 * (effectivePasteIndex + 1);
      const requestedPos = position ?? { x: pasteStep, y: pasteStep };

      const absMap = computeAbsolutePositionsWithinPayload(sourcePayload.nodes);
      let minX = Infinity;
      let minY = Infinity;
      for (const node of sourcePayload.nodes) {
        const abs = absMap.get(node.id) ?? node.position;
        if (abs.x < minX) minX = abs.x;
        if (abs.y < minY) minY = abs.y;
      }

      const delta = {
        x: requestedPos.x - minX,
        y: requestedPos.y - minY,
      };

      const oldIdSet = new Set(sourcePayload.nodes.map((n) => n.id));
      const rootOldIds = new Set(
        sourcePayload.nodes
          .filter((n) => !n.parentId || !oldIdSet.has(n.parentId))
          .map((n) => n.id),
      );

      const idMap = new Map<string, string>();
      for (const node of sourcePayload.nodes) {
        idMap.set(node.id, generateNodeId(node));
      }

      const unselectedExistingNodes = s.nodes.map((n) => ({ ...n, selected: false }));
      const unselectedExistingEdges = s.edges.map((e) => ({ ...e, selected: false }));

      const newNodesRaw: DiagramNode[] = sourcePayload.nodes.map((node) => {
        const newId = idMap.get(node.id)!;
        const parentId = node.parentId ? idMap.get(node.parentId) : undefined;

        if (node.parentId && !parentId) {
          const abs = absMap.get(node.id) ?? node.position;
          const { parentId: _pid, extent, expandParent, ...rest } = node as DiagramNode & { extent?: unknown; expandParent?: unknown };
          return {
            ...stripRuntimeFieldsFromNode(rest as DiagramNode),
            id: newId,
            position: { x: abs.x + delta.x, y: abs.y + delta.y },
            selected: true,
          } as DiagramNode;
        }

        const base = {
          ...stripRuntimeFieldsFromNode(node),
          id: newId,
          selected: true,
          ...(parentId ? { parentId, extent: "parent" as const, expandParent: true } : {}),
        } as DiagramNode;

        if (rootOldIds.has(node.id)) {
          return {
            ...base,
            position: { x: node.position.x + delta.x, y: node.position.y + delta.y },
          } as DiagramNode;
        }
        return base;
      });

      const newNodes = sortNodesParentsFirst(newNodesRaw);

      const newEdges: ArchEdge[] = sourcePayload.edges
        .map((edge) => {
          const source = idMap.get(edge.source);
          const target = idMap.get(edge.target);
          if (!source || !target) return null;
          return {
            ...stripRuntimeFieldsFromEdge(edge),
            id: `e_${uuidv4().slice(0, 10)}`,
            source,
            target,
            selected: true,
          } as ArchEdge;
        })
        .filter((x): x is ArchEdge => Boolean(x));

      return {
        ...s,
        clipboard: sourcePayload,
        clipboardKey: incomingKey ?? s.clipboardKey,
        clipboardPasteIndex: effectivePasteIndex + 1,
        nodes: [...unselectedExistingNodes, ...newNodes],
        edges: [...unselectedExistingEdges, ...newEdges],
      };
    });
    get().syncFlowToMermaid();
  },

  groupSelectedNodes: () => {
    const s = get();
    const selected = s.nodes.filter((n) => n.selected && n.type !== "groupNode");
    if (selected.length === 0) return;

    // Compute bounding box of selected nodes
    const PADDING = 40;
    const LABEL_HEIGHT = 30;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selected) {
      const w = (node.measured?.width ?? node.width ?? 180);
      const h = (node.measured?.height ?? node.height ?? 70);
      // If the node already has a parent, its position is relative to parent
      // We need absolute position; for simplicity we assume top-level nodes here
      const x = node.position.x;
      const y = node.position.y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + w > maxX) maxX = x + w;
      if (y + h > maxY) maxY = y + h;
    }

    const groupId = `group_${uuidv4().slice(0, 8)}`;
    const groupX = minX - PADDING;
    const groupY = minY - PADDING - LABEL_HEIGHT;
    const groupW = maxX - minX + PADDING * 2;
    const groupH = maxY - minY + PADDING * 2 + LABEL_HEIGHT;

    const groupNode: DiagramNode = {
      id: groupId,
      type: "groupNode",
      position: { x: groupX, y: groupY },
      data: { label: "Group" } as GroupNodeData,
      style: { width: groupW, height: groupH },
    };

    // Reparent selected nodes: position becomes relative to group
    const updatedNodes = s.nodes.map((n) => {
      if (!n.selected || n.type === "groupNode") return n;
      return {
        ...n,
        parentId: groupId,
        extent: "parent" as const,
        expandParent: true,
        position: {
          x: n.position.x - groupX,
          y: n.position.y - groupY,
        },
        selected: false,
      };
    });

    // Group node must appear before its children
    set({ nodes: [groupNode, ...updatedNodes] });
    get().syncFlowToMermaid();
  },

  ungroupSelectedNodes: () => {
    const s = get();
    const selectedGroups = s.nodes.filter((n) => n.selected && n.type === "groupNode");
    if (selectedGroups.length === 0) return;

    const groupIds = new Set(selectedGroups.map((g) => g.id));
    const groupPosMap = new Map(selectedGroups.map((g) => [g.id, g.position]));

    // Convert children back to absolute position and remove parentId
    const updatedNodes = s.nodes
      .filter((n) => !groupIds.has(n.id)) // remove group nodes
      .map((n) => {
        if (n.parentId && groupIds.has(n.parentId)) {
          const groupPos = groupPosMap.get(n.parentId)!;
          const { parentId, extent, expandParent, ...rest } = n as DiagramNode & { extent?: unknown; expandParent?: unknown };
          return {
            ...rest,
            position: {
              x: n.position.x + groupPos.x,
              y: n.position.y + groupPos.y,
            },
          } as typeof n;
        }
        return n;
      });

    set({ nodes: updatedNodes });
    get().syncFlowToMermaid();
  },

  reparentNode: (nodeId, newParentId) => {
    const s = get();
    const node = s.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Compute absolute position of the node (accounting for current parent)
    let absX = node.position.x;
    let absY = node.position.y;
    if (node.parentId) {
      const oldParent = s.nodes.find((n) => n.id === node.parentId);
      if (oldParent) {
        absX += oldParent.position.x;
        absY += oldParent.position.y;
      }
    }

    if (newParentId === null) {
      // Remove from group → absolute position
      const updatedNodes = s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        const { parentId, extent, expandParent, ...rest } = n as DiagramNode & { extent?: unknown; expandParent?: unknown };
        return { ...rest, position: { x: absX, y: absY } } as typeof n;
      });
      set({ nodes: updatedNodes });
    } else {
      const newParent = s.nodes.find((n) => n.id === newParentId);
      if (!newParent || newParent.type !== "groupNode") return;
      if (node.parentId === newParentId) return; // already in this group

      // Position relative to new parent
      const relX = absX - newParent.position.x;
      const relY = absY - newParent.position.y;

      // Ensure group node appears before children in the array
      const updatedNodes = s.nodes.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          parentId: newParentId,
          extent: "parent" as const,
          expandParent: true,
          position: { x: relX, y: relY },
        };
      });

      // Re-order: groups first, then their children
      const groups = updatedNodes.filter((n) => n.type === "groupNode");
      const nonGroups = updatedNodes.filter((n) => n.type !== "groupNode");
      set({ nodes: [...groups, ...nonGroups] });
    }
    get().syncFlowToMermaid();
  },

  sendToFront: () => {
    set((s) => {
      const selected = s.nodes.filter((n) => n.selected);
      if (selected.length === 0) return s;
      // Find the max zIndex
      const maxZ = Math.max(...s.nodes.map((n) => n.zIndex ?? 0));
      return {
        nodes: s.nodes.map((n) =>
          n.selected ? { ...n, zIndex: maxZ + 1 } : n
        ),
      };
    });
  },

  sendToBack: () => {
    set((s) => {
      const selected = s.nodes.filter((n) => n.selected);
      if (selected.length === 0) return s;
      // Find the min zIndex
      const minZ = Math.min(...s.nodes.map((n) => n.zIndex ?? 0));
      return {
        nodes: s.nodes.map((n) =>
          n.selected ? { ...n, zIndex: minZ - 1 } : n
        ),
      };
    });
  },

  sendForward: () => {
    set((s) => {
      const selected = s.nodes.filter((n) => n.selected);
      if (selected.length === 0) return s;
      return {
        nodes: s.nodes.map((n) =>
          n.selected ? { ...n, zIndex: (n.zIndex ?? 0) + 1 } : n
        ),
      };
    });
  },

  sendBackward: () => {
    set((s) => {
      const selected = s.nodes.filter((n) => n.selected);
      if (selected.length === 0) return s;
      return {
        nodes: s.nodes.map((n) =>
          n.selected ? { ...n, zIndex: (n.zIndex ?? 0) - 1 } : n
        ),
      };
    });
  },

  deleteSelected: () => {
    set((s) => {
      const deletedNodeIds = new Set(
        s.nodes.filter((n) => n.selected).map((n) => n.id)
      );

      const nextNodes = s.nodes.filter((n) => !n.selected);
      const nextEdges = s.edges.filter(
        (e) =>
          !e.selected &&
          !deletedNodeIds.has(e.source) &&
          !deletedNodeIds.has(e.target)
      );

      if (s._applyingHistory || s._syncingFromMermaid) {
        return { nodes: nextNodes, edges: nextEdges };
      }

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
        edges: nextEdges.map(stripRuntimeFieldsFromEdge),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        edges: nextEdges,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  updateNodeData: (nodeId, data) => {
    set((s) => {
      const nextNodes = s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } as typeof n : n
      );
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes: nextNodes };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nextNodes.map(stripRuntimeFieldsFromNode),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes: nextNodes,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  updateEdge: (edgeId, updates) => {
    set((s) => {
      const nextEdges = s.edges.map((e) => {
        if (e.id !== edgeId) return e;
        const merged: ArchEdge = {
          ...e,
          ...updates,
          data: { ...e.data, ...updates.data },
        };
        return merged;
      });
      if (s._applyingHistory || s._syncingFromMermaid) return { edges: nextEdges };

      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        edges: nextEdges.map(stripRuntimeFieldsFromEdge),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        edges: nextEdges,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  updateMermaidCode: (code) => {
    set({ mermaidCode: code, mermaidError: null, mermaidDiagnostics: [] });
  },

  syncFlowToMermaid: () => {
    const s = get();
    if (s._syncingFromMermaid) return;
    set({ _syncingFromFlow: true });
    const code = flowToMermaid(s.nodes, s.edges);
    set({ mermaidCode: code, _syncingFromFlow: false, mermaidError: null, mermaidDiagnostics: [] });
  },

  syncMermaidToFlow: async () => {
    const s = get();
    if (s._syncingFromFlow) return;
    set({ _syncingFromMermaid: true });
    try {
      const preservedNonMermaidNodes = s.nodes.filter((n) => n.type === "textNode");
      const preservedAbsPos = preservedNonMermaidNodes.length > 0 ? buildAbsolutePositionMap(s.nodes) : new Map<string, { x: number; y: number }>();

      const { nodes: parsedNodes, edges: parsedEdges, subgraphs } = mermaidToFlow(
        s.mermaidCode,
        s.nodes, // pass existing nodes so visual metadata (shapeType, etc.) is preserved
        s.edges,
      );
      // Preserve positions for nodes that already exist
      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const needsLayout: DiagramNode[] = [];
      const lockedNodeIds: string[] = [];
      const merged = parsedNodes.map((n) => {
        const existingAbs = absPosMap.get(n.id);
        const stripped = stripGroupingFromNode(n);
        if (existingAbs) {
          lockedNodeIds.push(n.id);
          return { ...stripped, position: existingAbs };
        }
        needsLayout.push(stripped);
        return stripped;
      });

      let finalNodes = merged;
      if (needsLayout.length > 0) {
        finalNodes = await autoLayout(merged, parsedEdges, { lockedNodeIds });
      }
      finalNodes = applyMermaidSubgraphGroups(finalNodes, subgraphs);

      // Assign edge handles based on closest-side routing
      const layoutDir: LayoutDirection = s.layoutDirection ?? "DOWN";
      const positionedEdges = applyEdgePositions(finalNodes, parsedEdges, layoutDir, "CLOSEST");

      if (preservedNonMermaidNodes.length > 0) {
        const finalNodeIds = new Set(finalNodes.map((n) => n.id));
        const preserved = preservedNonMermaidNodes.map((n) => {
          if (!n.parentId) return n;
          if (finalNodeIds.has(n.parentId)) return n;
          const abs = preservedAbsPos.get(n.id) ?? n.position;
          const { parentId, extent, expandParent, ...rest } = n as DiagramNode & { extent?: unknown; expandParent?: unknown };
          return { ...rest, position: abs } as typeof n;
        });
        finalNodes = [...finalNodes, ...preserved];
      }

      // Preserve existing edge objects when source/target/label haven't changed
      // so React Flow doesn't re-route them.
      const existingEdgeMap = new Map(s.edges.map((e) => [e.id, e]));
      const mergedEdges = positionedEdges.map((pe) => {
        const existing = existingEdgeMap.get(pe.id);
        if (existing) {
          // Keep the existing edge, only update label if changed
          const existingLabel = existing.data?.label ?? existing.label;
          const parsedLabel = pe.data?.label ?? pe.label;
          if (existingLabel === parsedLabel) return existing;
          return { ...existing, label: pe.label, data: { ...existing.data, ...pe.data } };
        }
        return pe;
      });

      set((curr) => {
        if (curr._applyingHistory) {
          return { nodes: finalNodes, edges: mergedEdges, _syncingFromMermaid: false };
        }
        const current = snapshotFromState(curr);
        const nextSnapshot: DiagramHistorySnapshot = {
          ...current,
          nodes: finalNodes.map(stripRuntimeFieldsFromNode),
          edges: mergedEdges.map(stripRuntimeFieldsFromEdge),
        };
        const past = pushHistory(current, curr._historyPast, nextSnapshot);
        return {
          nodes: finalNodes,
          edges: mergedEdges,
          _syncingFromMermaid: false,
          mermaidError: null,
          mermaidDiagnostics: [],
          _historyPast: past,
          _historyFuture: [],
          canUndo: past.length > 0,
          canRedo: false,
        };
      });
    } catch (error) {
      if (error instanceof MermaidParseError) {
        const diagnostics = error.diagnostics;
        const summary = diagnostics
          .slice(0, 3)
          .map((diagnostic) => `Line ${diagnostic.line}: ${diagnostic.message}`)
          .join(" ");
        set({
          _syncingFromMermaid: false,
          mermaidError: summary || error.message,
          mermaidDiagnostics: diagnostics,
        });
        return;
      }
      set({
        _syncingFromMermaid: false,
        mermaidError: "Mermaid reconciliation failed.",
        mermaidDiagnostics: [],
      });
    }
  },

  runAutoLayout: async (direction, edgeAttachMode) => {
    const s = get();
    if (s.nodes.length === 0) return;

    const dir: LayoutDirection = direction ?? s.layoutDirection ?? "RIGHT";
    const attachMode: EdgeAttachMode = edgeAttachMode ?? "CLOSEST";

    const hasGroups = s.nodes.some((n) => n.type === "groupNode");
    if (!hasGroups) {
      const laid = await autoLayout(s.nodes, s.edges, { direction: dir });
      const laidEdges = applyEdgePositions(laid, s.edges, dir, attachMode);
      if (s._applyingHistory || s._syncingFromMermaid) {
        set({ nodes: laid, edges: laidEdges, layoutDirection: dir });
        return;
      }
      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: laid.map(stripRuntimeFieldsFromNode),
        edges: laidEdges.map(stripRuntimeFieldsFromEdge),
        layoutDirection: dir,
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      set({
        nodes: laid,
        edges: laidEdges,
        layoutDirection: dir,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      });
      return;
    }

    const absPosMap = buildAbsolutePositionMap(s.nodes);
    const { subgraphs, templates } = extractExistingGroupSubgraphs(s.nodes);

    const flatNodes = s.nodes
      .filter((n) => n.type !== "groupNode")
      .map((n) => {
        const abs = absPosMap.get(n.id);
        const stripped = stripGroupingFromNode(n);
        if (!abs) return stripped;
        return { ...stripped, position: abs };
      });

    const flatNodeIds = new Set(flatNodes.map((n) => n.id));
    const flatEdges = s.edges.filter(
      (e) => flatNodeIds.has(e.source) && flatNodeIds.has(e.target)
    );

    const laidFlatNodes = await autoLayout(flatNodes, flatEdges, { direction: dir });
    const rebuilt = applyMermaidSubgraphGroups(laidFlatNodes, subgraphs, {
      preserveGroupIds: true,
      groupTemplates: templates,
    });
    const packed = packRootNodesToAvoidOverlaps(rebuilt);
    const laidEdges = applyEdgePositions(packed, s.edges, dir, attachMode);
    if (s._applyingHistory || s._syncingFromMermaid) {
      set({ nodes: packed, edges: laidEdges, layoutDirection: dir });
      return;
    }
    const current = snapshotFromState(s);
    const nextSnapshot: DiagramHistorySnapshot = {
      ...current,
      nodes: packed.map(stripRuntimeFieldsFromNode),
      edges: laidEdges.map(stripRuntimeFieldsFromEdge),
      layoutDirection: dir,
    };
    const past = pushHistory(current, s._historyPast, nextSnapshot);
    set({
      nodes: packed,
      edges: laidEdges,
      layoutDirection: dir,
      _historyPast: past,
      _historyFuture: [],
      canUndo: past.length > 0,
      canRedo: false,
    });
  },

  setNodesAndEdges: (nodes, edges) => {
    set((s) => {
      if (s._applyingHistory || s._syncingFromMermaid) return { nodes, edges };
      const current = snapshotFromState(s);
      const nextSnapshot: DiagramHistorySnapshot = {
        ...current,
        nodes: nodes.map(stripRuntimeFieldsFromNode),
        edges: edges.map(stripRuntimeFieldsFromEdge),
      };
      const past = pushHistory(current, s._historyPast, nextSnapshot);
      return {
        nodes,
        edges,
        _historyPast: past,
        _historyFuture: [],
        canUndo: past.length > 0,
        canRedo: false,
      };
    });
    get().syncFlowToMermaid();
  },

  resolveOverlapsForNode: (nodeId) => {
    set((s) => {
      const node = s.nodes.find((n) => n.id === nodeId);
      if (!node || node.type === "groupNode") return s;

      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const desiredAbs = absPosMap.get(nodeId);
      if (!desiredAbs) return s;

      const obstacles = s.nodes
        .filter(
          (n) =>
            n.id !== nodeId &&
            n.type !== "groupNode" &&
            (n.parentId ?? null) === (node.parentId ?? null),
        )
        .map((n) => {
          const abs = absPosMap.get(n.id);
          if (!abs) return null;
          const { w, h } = estimateNodeSizeForOverlap(n);
          return { x: abs.x, y: abs.y, w, h } satisfies OverlapRect;
        })
        .filter((x): x is OverlapRect => Boolean(x));

      const { w, h } = estimateNodeSizeForOverlap(node);
      const freeAbs = findNonOverlappingAbsPosition(desiredAbs, { w, h }, obstacles);
      if (freeAbs.x === desiredAbs.x && freeAbs.y === desiredAbs.y) return s;

      const parentAbs = node.parentId ? absPosMap.get(node.parentId) : undefined;
      const nextPosition = parentAbs
        ? { x: freeAbs.x - parentAbs.x, y: freeAbs.y - parentAbs.y }
        : freeAbs;

      return {
        nodes: s.nodes.map((n) => (n.id === nodeId ? { ...n, position: nextPosition } : n)),
      };
    });
  },
}));
