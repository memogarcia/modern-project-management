import type { ArchEdge, DiagramNode } from "@/lib/types";
import dagre from "dagre";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  anchorPoint,
  computeOrthogonalEdgeRoutes,
  determineRelativeSides,
  inferPointSide,
  offsetPoint,
  shiftRoute,
  simplifyPoints,
  type EdgeRoutePoint,
  type EdgeRouteSide,
  type OrthogonalRoutingOptions,
  type StoredEdgeRoute,
} from "@/lib/edgeRouting";
import { estimateNodeSize, getNodeRect, type NodeRect } from "@/lib/nodeSizing";

export type LayoutDirection = "DOWN" | "RIGHT";
export type AutoLayoutStrategy = "RELAX" | "ELK";
export type LayoutPresetId =
  | "diagram-horizontal"
  | "diagram-vertical"
  | "mindmap"
  | "org-tree";

export type GraphLayoutOptions = {
  preset?: LayoutPresetId;
  direction?: LayoutDirection;
  strategy?: AutoLayoutStrategy;
  lockedNodeIds?: string[] | Set<string>;
};

export type GraphLayoutResult = {
  nodes: DiagramNode[];
  routes: Map<string, StoredEdgeRoute>;
  preset: LayoutPresetId;
  direction: LayoutDirection;
};

type LayoutPresetKind = "diagram" | "mindmap" | "org";

type ResolvedLayoutPreset = {
  id: LayoutPresetId;
  kind: LayoutPresetKind;
  direction: LayoutDirection;
  targetAspectRatio: number;
  componentGap: number;
  incrementalPadding: number;
  incrementalLinkDistance: number;
  orthogonalRouting: Partial<OrthogonalRoutingOptions>;
  elkOptions?: Record<string, string>;
  mindmap?: {
    rootGap: number;
    levelGap: number;
    siblingGap: number;
    branchGap: number;
    curveOffset: number;
  };
};

type LayoutBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type GraphComponent = {
  nodes: DiagramNode[];
  edges: ArchEdge[];
};

type PositionedComponent = {
  nodes: DiagramNode[];
  routes: Map<string, StoredEdgeRoute>;
  bounds: LayoutBounds;
};

type RelaxSimNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  pinned: boolean;
  anchorX: number;
  anchorY: number;
};

const DAGRE_DEFAULTS = {
  nodeSep: 160,
  rankSep: 240,
  edgeSep: 70,
  ranker: "network-simplex" as const,
};

const elk = new ELK();

const LAYOUT_PRESETS: Record<LayoutPresetId, ResolvedLayoutPreset> = {
  "diagram-horizontal": {
    id: "diagram-horizontal",
    kind: "diagram",
    direction: "RIGHT",
    targetAspectRatio: 1.6,
    componentGap: 240,
    incrementalPadding: 54,
    incrementalLinkDistance: 320,
    orthogonalRouting: {
      gridSize: 24,
      nodePadding: 34,
      portOffset: 54,
      searchMargin: 220,
      maxSearchCells: 28000,
    },
    elkOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=80,left=80,bottom=80,right=80]",
      "elk.spacing.nodeNode": "96",
      "elk.spacing.edgeNode": "68",
      "elk.spacing.edgeEdge": "36",
      "elk.layered.spacing.baseValue": "72",
      "elk.layered.spacing.nodeNodeBetweenLayers": "250",
      "elk.layered.spacing.edgeNodeBetweenLayers": "96",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "56",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.layered.thoroughness": "40",
    },
  },
  "diagram-vertical": {
    id: "diagram-vertical",
    kind: "diagram",
    direction: "DOWN",
    targetAspectRatio: 1.05,
    componentGap: 220,
    incrementalPadding: 50,
    incrementalLinkDistance: 270,
    orthogonalRouting: {
      gridSize: 24,
      nodePadding: 32,
      portOffset: 50,
      searchMargin: 220,
      maxSearchCells: 28000,
    },
    elkOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=72,left=72,bottom=72,right=72]",
      "elk.spacing.nodeNode": "92",
      "elk.spacing.edgeNode": "64",
      "elk.spacing.edgeEdge": "34",
      "elk.layered.spacing.baseValue": "68",
      "elk.layered.spacing.nodeNodeBetweenLayers": "220",
      "elk.layered.spacing.edgeNodeBetweenLayers": "92",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "52",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.layered.unnecessaryBendpoints": "true",
      "elk.layered.thoroughness": "40",
    },
  },
  mindmap: {
    id: "mindmap",
    kind: "mindmap",
    direction: "RIGHT",
    targetAspectRatio: 1.45,
    componentGap: 280,
    incrementalPadding: 52,
    incrementalLinkDistance: 300,
    orthogonalRouting: {
      gridSize: 24,
      nodePadding: 30,
      portOffset: 50,
      searchMargin: 220,
      maxSearchCells: 26000,
    },
    mindmap: {
      rootGap: 250,
      levelGap: 210,
      siblingGap: 64,
      branchGap: 96,
      curveOffset: 78,
    },
  },
  "org-tree": {
    id: "org-tree",
    kind: "org",
    direction: "DOWN",
    targetAspectRatio: 1.15,
    componentGap: 220,
    incrementalPadding: 48,
    incrementalLinkDistance: 260,
    orthogonalRouting: {
      gridSize: 22,
      nodePadding: 30,
      portOffset: 48,
      searchMargin: 210,
      maxSearchCells: 26000,
    },
    elkOptions: {
      "elk.algorithm": "mrtree",
      "elk.direction": "DOWN",
      "elk.padding": "[top=72,left=72,bottom=72,right=72]",
      "elk.spacing.nodeNode": "84",
      "elk.spacing.edgeNode": "54",
      "elk.spacing.edgeEdge": "34",
    },
  },
};

function stableHashInt(input: string): number {
  let h = 2166136261;
  for (let index = 0; index < input.length; index++) {
    h ^= input.charCodeAt(index);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hasMeaningfulPositions(nodes: DiagramNode[]): boolean {
  if (nodes.length === 0) return false;
  let have = 0;
  const unique = new Set<string>();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position?.x;
    const y = node.position?.y;
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    have++;
    unique.add(`${Math.round(x)}:${Math.round(y)}`);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (have < Math.ceil(nodes.length * 0.8)) return false;
  if (unique.size <= 1) return false;
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  return spanX >= 40 || spanY >= 40;
}

function defaultPresetForDirection(direction: LayoutDirection): LayoutPresetId {
  return direction === "DOWN" ? "diagram-vertical" : "diagram-horizontal";
}

export function defaultDirectionForPreset(preset: LayoutPresetId): LayoutDirection {
  return LAYOUT_PRESETS[preset].direction;
}

function resolvePreset(options?: GraphLayoutOptions): ResolvedLayoutPreset {
  const explicitPreset =
    options?.preset ??
    (options?.direction ? defaultPresetForDirection(options.direction) : "diagram-horizontal");

  if (explicitPreset === "diagram-horizontal" || explicitPreset === "diagram-vertical") {
    const direction = options?.direction ?? LAYOUT_PRESETS[explicitPreset].direction;
    return LAYOUT_PRESETS[defaultPresetForDirection(direction)];
  }

  return LAYOUT_PRESETS[explicitPreset];
}

function sortNodesForStableLayout(
  nodes: DiagramNode[],
  direction: LayoutDirection
): DiagramNode[] {
  return [...nodes].sort((a, b) => {
    const aPrimary =
      direction === "RIGHT"
        ? (a.position?.y ?? 0) - (b.position?.y ?? 0)
        : (a.position?.x ?? 0) - (b.position?.x ?? 0);
    if (aPrimary !== 0) return aPrimary;

    const aSecondary =
      direction === "RIGHT"
        ? (a.position?.x ?? 0) - (b.position?.x ?? 0)
        : (a.position?.y ?? 0) - (b.position?.y ?? 0);
    if (aSecondary !== 0) return aSecondary;

    return a.id.localeCompare(b.id);
  });
}

function computeBounds(
  nodes: DiagramNode[],
  routes?: Map<string, StoredEdgeRoute>
): LayoutBounds {
  if (nodes.length === 0) {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;

  for (const node of nodes) {
    const rect = getNodeRect(node);
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }

  for (const route of routes?.values() ?? []) {
    for (const point of route.points) {
      left = Math.min(left, point.x);
      top = Math.min(top, point.y);
      right = Math.max(right, point.x);
      bottom = Math.max(bottom, point.y);
    }
  }

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function shiftNodes(nodes: DiagramNode[], dx: number, dy: number): DiagramNode[] {
  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + dx,
      y: node.position.y + dy,
    },
  }));
}

function normalizeComponent(component: PositionedComponent): PositionedComponent {
  const dx = -component.bounds.left;
  const dy = -component.bounds.top;

  const nodes = shiftNodes(component.nodes, dx, dy);
  const routes = new Map<string, StoredEdgeRoute>();
  for (const [edgeId, route] of component.routes) {
    routes.set(edgeId, shiftRoute(route, dx, dy));
  }

  return {
    nodes,
    routes,
    bounds: computeBounds(nodes, routes),
  };
}

function buildConnectedComponents(
  nodes: DiagramNode[],
  edges: ArchEdge[]
): GraphComponent[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();

  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const components: GraphComponent[] = [];

  for (const node of sortNodesForStableLayout(nodes, "RIGHT")) {
    if (visited.has(node.id)) continue;

    const queue = [node.id];
    const componentNodeIds = new Set<string>();
    visited.add(node.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentNodeIds.add(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push({
      nodes: nodes.filter((candidate) => componentNodeIds.has(candidate.id)),
      edges: edges.filter(
        (edge) =>
          componentNodeIds.has(edge.source) && componentNodeIds.has(edge.target)
      ),
    });
  }

  return components;
}

function fallbackGridLayout(
  nodes: DiagramNode[],
  direction: LayoutDirection
): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  const sorted = sortNodesForStableLayout(nodes, direction);
  let maxWidth = 0;
  let maxHeight = 0;

  for (const node of sorted) {
    const size = estimateNodeSize(node);
    maxWidth = Math.max(maxWidth, size.width);
    maxHeight = Math.max(maxHeight, size.height);
  }

  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
  const xGap = 180;
  const yGap = 140;
  const gridWidth = maxWidth + xGap;
  const gridHeight = maxHeight + yGap;

  return sorted.map((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = direction === "RIGHT" ? col * gridWidth : row * gridWidth;
    const y = direction === "RIGHT" ? row * gridHeight : col * gridHeight;

    return {
      ...node,
      position: { x, y },
    };
  });
}

function relaxLayoutFromCurrentPositions(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset,
  options?: {
    lockedNodeIds?: ReadonlySet<string>;
  }
): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  const lockedNodeIds = options?.lockedNodeIds ?? new Set<string>();
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const neighbors = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    if (!neighbors.has(edge.source)) neighbors.set(edge.source, new Set());
    if (!neighbors.has(edge.target)) neighbors.set(edge.target, new Set());
    neighbors.get(edge.source)!.add(edge.target);
    neighbors.get(edge.target)!.add(edge.source);
  }

  const sizes = new Map<string, { w: number; h: number }>();
  for (const node of nodes) {
    const { width, height } = estimateNodeSize(node);
    sizes.set(node.id, { w: width, h: height });
  }

  const duplicateCount = new Map<string, number>();
  for (const node of nodes) {
    const key = `${Math.round(node.position?.x ?? 0)}:${Math.round(node.position?.y ?? 0)}`;
    duplicateCount.set(key, (duplicateCount.get(key) ?? 0) + 1);
  }

  let centroidX = 0;
  let centroidY = 0;
  for (const node of nodes) {
    centroidX += node.position?.x ?? 0;
    centroidY += node.position?.y ?? 0;
  }
  centroidX /= Math.max(1, nodes.length);
  centroidY /= Math.max(1, nodes.length);

  const sim: RelaxSimNode[] = nodes.map((node) => {
    const baseX = node.position?.x ?? 0;
    const baseY = node.position?.y ?? 0;
    const pinned = lockedNodeIds.has(node.id);
    const { w, h } = sizes.get(node.id)!;

    let x = baseX;
    let y = baseY;
    let anchorX = baseX;
    let anchorY = baseY;

    if (!pinned) {
      const key = `${Math.round(baseX)}:${Math.round(baseY)}`;
      const isDuplicate = (duplicateCount.get(key) ?? 0) > 1;
      const looksUnplaced = (baseX === 0 && baseY === 0) || isDuplicate;

      if (looksUnplaced) {
        const lockedNeighbors = neighbors.get(node.id);
        let accX = 0;
        let accY = 0;
        let count = 0;

        if (lockedNeighbors) {
          for (const neighborId of lockedNeighbors) {
            if (!lockedNodeIds.has(neighborId)) continue;
            const neighborNode = nodeById.get(neighborId);
            if (!neighborNode) continue;
            accX += neighborNode.position?.x ?? 0;
            accY += neighborNode.position?.y ?? 0;
            count++;
          }
        }

        const seed = stableHashInt(node.id);
        const jitter = 32 + (seed % 20);
        const jx = ((seed & 1) === 0 ? -1 : 1) * jitter;
        const jy = ((seed & 2) === 0 ? -1 : 1) * jitter;

        if (count > 0) {
          x = accX / count + jx;
          y = accY / count + jy;
        } else {
          x = centroidX + jx;
          y = centroidY + jy;
        }

        anchorX = x;
        anchorY = y;
      }
    }

    return { id: node.id, x, y, vx: 0, vy: 0, w, h, pinned, anchorX, anchorY };
  });

  const simById = new Map(sim.map((entry) => [entry.id, entry]));
  const iterations = 96;
  const damping = 0.78;
  const anchorStrength = lockedNodeIds.size > 0 ? 0.038 : 0.06;
  const linkStrength = 0.014;

  for (let iteration = 0; iteration < iterations; iteration++) {
    for (let i = 0; i < sim.length; i++) {
      const a = sim[i]!;
      for (let j = i + 1; j < sim.length; j++) {
        const b = sim[j]!;

        const ax = a.x + a.w / 2;
        const ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;

        let dx = bx - ax;
        let dy = by - ay;
        if (dx === 0 && dy === 0) {
          const seed = (stableHashInt(`${a.id}:${b.id}`) & 1) === 0 ? -1 : 1;
          dx = seed * 0.01;
          dy = -seed * 0.01;
        }

        const overlapX = (a.w + b.w) / 2 + preset.incrementalPadding - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + preset.incrementalPadding - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        if (overlapX < overlapY) {
          const push = (overlapX + 1) * (dx < 0 ? -1 : 1) * 0.56;
          if (!a.pinned) a.vx -= push;
          if (!b.pinned) b.vx += push;
        } else {
          const push = (overlapY + 1) * (dy < 0 ? -1 : 1) * 0.56;
          if (!a.pinned) a.vy -= push;
          if (!b.pinned) b.vy += push;
        }
      }
    }

    for (const edge of edges) {
      const a = simById.get(edge.source);
      const b = simById.get(edge.target);
      if (!a || !b) continue;

      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const delta = distance - preset.incrementalLinkDistance;
      const fx = (dx / distance) * delta * linkStrength;
      const fy = (dy / distance) * delta * linkStrength;

      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const node of sim) {
      if (node.pinned) continue;
      node.vx += (node.anchorX - node.x) * anchorStrength;
      node.vy += (node.anchorY - node.y) * anchorStrength;
    }

    for (const node of sim) {
      if (node.pinned) continue;
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  let originalCenterX = 0;
  let originalCenterY = 0;
  let newCenterX = 0;
  let newCenterY = 0;
  let count = 0;

  for (const node of sim) {
    if (node.pinned) continue;
    const original = nodeById.get(node.id);
    if (!original) continue;
    originalCenterX += (original.position?.x ?? 0) + node.w / 2;
    originalCenterY += (original.position?.y ?? 0) + node.h / 2;
    newCenterX += node.x + node.w / 2;
    newCenterY += node.y + node.h / 2;
    count++;
  }

  if (count > 0) {
    const dx = originalCenterX / count - newCenterX / count;
    const dy = originalCenterY / count - newCenterY / count;
    for (const node of sim) {
      if (node.pinned) continue;
      node.x += dx;
      node.y += dy;
    }
  }

  const positioned = new Map(sim.map((entry) => [entry.id, entry]));
  return nodes.map((node) => {
    const next = positioned.get(node.id);
    if (!next) return node;
    return {
      ...node,
      position: {
        x: next.x,
        y: next.y,
      },
    };
  });
}

function buildElkGraph(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  layoutOptions: Record<string, string>
) {
  const children = sortNodesForStableLayout(nodes, layoutOptions["elk.direction"] === "DOWN" ? "DOWN" : "RIGHT").map(
    (node) => {
      const { width, height } = estimateNodeSize(node);
      return {
        id: node.id,
        width,
        height,
      };
    }
  );

  const childIds = new Set(children.map((child) => child.id));

  return {
    id: "root",
    layoutOptions,
    children,
    edges: [...edges]
      .filter((edge) => childIds.has(edge.source) && childIds.has(edge.target))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
  };
}

function applyPositionMap(
  nodes: DiagramNode[],
  positions: Map<string, { x: number; y: number }>
): DiagramNode[] {
  return nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position) return node;
    return {
      ...node,
      position,
    };
  });
}

async function dagreLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection
): Promise<DiagramNode[]> {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: direction === "DOWN" ? "TB" : "LR",
    nodesep: DAGRE_DEFAULTS.nodeSep,
    ranksep: DAGRE_DEFAULTS.rankSep,
    edgesep: DAGRE_DEFAULTS.edgeSep,
    ranker: DAGRE_DEFAULTS.ranker,
  });

  const sizes = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const { width, height } = estimateNodeSize(node);
    sizes.set(node.id, { width, height });
    graph.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    if (sizes.has(edge.source) && sizes.has(edge.target)) {
      graph.setEdge(edge.source, edge.target);
    }
  }

  try {
    dagre.layout(graph);
  } catch {
    return fallbackGridLayout(nodes, direction);
  }

  return nodes.map((node) => {
    const position = graph.node(node.id);
    const size = sizes.get(node.id);
    if (!position || !size) return node;

    return {
      ...node,
      position: {
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
      },
    };
  });
}

function orthogonalizePath(points: EdgeRoutePoint[]): EdgeRoutePoint[] {
  if (points.length <= 1) return points;
  const output: EdgeRoutePoint[] = [points[0]!];

  for (let index = 1; index < points.length; index++) {
    const previous = output[output.length - 1]!;
    const next = points[index]!;

    if (previous.x === next.x || previous.y === next.y) {
      output.push(next);
      continue;
    }

    const horizontalFirst =
      Math.abs(next.x - previous.x) >= Math.abs(next.y - previous.y);
    output.push(
      horizontalFirst
        ? { x: next.x, y: previous.y }
        : { x: previous.x, y: next.y }
    );
    output.push(next);
  }

  return simplifyPoints(output);
}

function extractElkDiagramRoutes(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  elkEdges: Array<{
    id: string;
    sections?: Array<{
      startPoint?: { x: number; y: number };
      endPoint?: { x: number; y: number };
      bendPoints?: Array<{ x: number; y: number }>;
    }>;
  }>
): Map<string, StoredEdgeRoute> {
  const rectById = new Map(nodes.map((node) => [node.id, getNodeRect(node)]));
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const routes = new Map<string, StoredEdgeRoute>();

  for (const edge of elkEdges) {
    const modelEdge = edgeById.get(edge.id);
    if (!modelEdge) continue;

    const sourceRect = rectById.get(modelEdge.source);
    const targetRect = rectById.get(modelEdge.target);
    const section = edge.sections?.[0];
    const startPoint = section?.startPoint;
    const endPoint = section?.endPoint;

    if (!sourceRect || !targetRect || !startPoint || !endPoint) {
      continue;
    }

    const sourceSide = inferPointSide(sourceRect, startPoint);
    const targetSide = inferPointSide(targetRect, endPoint);
    const sourceAnchor = anchorPoint(sourceRect, sourceSide);
    const targetAnchor = anchorPoint(targetRect, targetSide);
    const rawPoints: EdgeRoutePoint[] = [
      sourceAnchor,
      ...(section?.bendPoints?.map((point) => ({
        x: point.x,
        y: point.y,
      })) ?? []),
      targetAnchor,
    ];

    routes.set(edge.id, {
      sourceSide,
      targetSide,
      style: "orthogonal",
      points: orthogonalizePath(rawPoints),
    });
  }

  return routes;
}

async function layoutWithElk(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset
): Promise<{ nodes: DiagramNode[]; routes: Map<string, StoredEdgeRoute> }> {
  const layoutOptions = preset.elkOptions;
  if (!layoutOptions) {
    return {
      nodes: await dagreLayout(nodes, edges, preset.direction),
      routes: new Map(),
    };
  }

  try {
    const graph = buildElkGraph(nodes, edges, layoutOptions);
    const laidOut = await elk.layout(graph);
    const positions = new Map<string, { x: number; y: number }>();

    for (const child of laidOut.children ?? []) {
      if (typeof child.x !== "number" || typeof child.y !== "number") continue;
      positions.set(child.id, { x: child.x, y: child.y });
    }

    if (positions.size === 0) {
      return {
        nodes: await dagreLayout(nodes, edges, preset.direction),
        routes: new Map(),
      };
    }

    const positionedNodes = applyPositionMap(nodes, positions);
    const routes =
      preset.kind === "diagram"
        ? extractElkDiagramRoutes(
            positionedNodes,
            edges,
            (laidOut.edges ?? []) as Array<{
              id: string;
              sections?: Array<{
                startPoint?: { x: number; y: number };
                endPoint?: { x: number; y: number };
                bendPoints?: Array<{ x: number; y: number }>;
              }>;
            }>
          )
        : new Map<string, StoredEdgeRoute>();

    return {
      nodes: positionedNodes,
      routes,
    };
  } catch {
    return {
      nodes: await dagreLayout(nodes, edges, preset.direction),
      routes: new Map(),
    };
  }
}

function isOrgTreeLike(nodes: DiagramNode[], edges: ArchEdge[]): boolean {
  if (nodes.length <= 1) return true;
  if (edges.length > nodes.length - 1) return false;

  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    if (!indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    if ((indegree.get(edge.target) ?? 0) > 1) return false;
  }

  const queue = nodes
    .map((node) => node.id)
    .filter((id) => (indegree.get(id) ?? 0) === 0);

  if (queue.length === 0) return false;

  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge.target);
    outgoing.set(edge.source, list);
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const target of outgoing.get(current) ?? []) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if ((indegree.get(target) ?? 0) === 0) {
        queue.push(target);
      }
    }
  }

  return visited === nodes.length;
}

function sortNeighborIds(
  nodeId: string,
  neighborIds: string[],
  nodeById: Map<string, DiagramNode>
): string[] {
  const source = nodeById.get(nodeId);
  return [...neighborIds].sort((a, b) => {
    const nodeA = nodeById.get(a);
    const nodeB = nodeById.get(b);
    if (!nodeA || !nodeB) return a.localeCompare(b);

    const deltaY = (nodeA.position?.y ?? 0) - (nodeB.position?.y ?? 0);
    if (deltaY !== 0) return deltaY;

    const deltaX = (nodeA.position?.x ?? 0) - (nodeB.position?.x ?? 0);
    if (deltaX !== 0) return deltaX;

    if (source) {
      const aDistance = Math.abs((nodeA.position?.x ?? 0) - (source.position?.x ?? 0));
      const bDistance = Math.abs((nodeB.position?.x ?? 0) - (source.position?.x ?? 0));
      if (aDistance !== bDistance) return aDistance - bDistance;
    }

    return a.localeCompare(b);
  });
}

function selectCentralNode(
  nodes: DiagramNode[],
  edges: ArchEdge[]
): string {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(nodes.map((node) => [node.id, 0]));
  const degree = new Map(nodes.map((node) => [node.id, 0]));

  for (const edge of edges) {
    if (!degree.has(edge.source) || !degree.has(edge.target)) continue;
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    outdegree.set(edge.source, (outdegree.get(edge.source) ?? 0) + 1);
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
  }

  const allNodes = [...nodes];
  allNodes.sort((a, b) => {
    const aInbound = indegree.get(a.id) ?? 0;
    const bInbound = indegree.get(b.id) ?? 0;
    const aOutbound = outdegree.get(a.id) ?? 0;
    const bOutbound = outdegree.get(b.id) ?? 0;
    const aScore =
      (aInbound === 0 ? 220 : 0) + aOutbound * 40 + (degree.get(a.id) ?? 0) * 20 - aInbound * 4;
    const bScore =
      (bInbound === 0 ? 220 : 0) + bOutbound * 40 + (degree.get(b.id) ?? 0) * 20 - bInbound * 4;
    if (aScore !== bScore) return bScore - aScore;
    return a.id.localeCompare(b.id);
  });

  return allNodes[0]?.id ?? nodes[0]!.id;
}

function buildTraversalTree(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  rootId: string
): {
  parentById: Map<string, string | null>;
  childrenById: Map<string, string[]>;
} {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const undirected = new Map<string, Set<string>>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
    undirected.set(node.id, new Set());
  }

  for (const edge of edges) {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) continue;
    outgoing.get(edge.source)!.push(edge.target);
    incoming.get(edge.target)!.push(edge.source);
    undirected.get(edge.source)!.add(edge.target);
    undirected.get(edge.target)!.add(edge.source);
  }

  const parentById = new Map<string, string | null>([[rootId, null]]);
  const childrenById = new Map<string, string[]>();
  const queue = [rootId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const preferredNeighbors = sortNeighborIds(
      current,
      [
        ...outgoing.get(current)!,
        ...incoming.get(current)!,
        ...undirected.get(current)!,
      ],
      nodeById
    );

    for (const neighbor of preferredNeighbors) {
      if (parentById.has(neighbor)) continue;
      parentById.set(neighbor, current);
      const list = childrenById.get(current) ?? [];
      list.push(neighbor);
      childrenById.set(current, list);
      queue.push(neighbor);
    }
  }

  for (const node of nodes) {
    if (parentById.has(node.id)) continue;
    parentById.set(node.id, rootId);
    const list = childrenById.get(rootId) ?? [];
    list.push(node.id);
    childrenById.set(rootId, list);
  }

  return { parentById, childrenById };
}

function measureTreeSpan(
  nodeId: string,
  nodeById: Map<string, DiagramNode>,
  childrenById: Map<string, string[]>,
  siblingGap: number,
  cache: Map<string, number>
): number {
  const cached = cache.get(nodeId);
  if (cached != null) return cached;

  const node = nodeById.get(nodeId)!;
  const children = childrenById.get(nodeId) ?? [];
  const nodeHeight = estimateNodeSize(node).height;

  if (children.length === 0) {
    cache.set(nodeId, nodeHeight);
    return nodeHeight;
  }

  let total = 0;
  children.forEach((childId, index) => {
    total += measureTreeSpan(childId, nodeById, childrenById, siblingGap, cache);
    if (index < children.length - 1) {
      total += siblingGap;
    }
  });

  const span = Math.max(nodeHeight, total);
  cache.set(nodeId, span);
  return span;
}

function placeMindmapBranch(
  nodeId: string,
  centerX: number,
  centerY: number,
  side: -1 | 1,
  nodeById: Map<string, DiagramNode>,
  childrenById: Map<string, string[]>,
  preset: ResolvedLayoutPreset,
  spanCache: Map<string, number>,
  positions: Map<string, { x: number; y: number }>,
  depth = 0
): void {
  const node = nodeById.get(nodeId)!;
  const size = estimateNodeSize(node);
  positions.set(nodeId, {
    x: centerX - size.width / 2,
    y: centerY - size.height / 2,
  });

  const children = childrenById.get(nodeId) ?? [];
  if (children.length === 0) return;

  const siblingGap = preset.mindmap!.siblingGap;
  const branchGap = preset.mindmap!.branchGap;
  let totalSpan = 0;
  children.forEach((childId, index) => {
    totalSpan += spanCache.get(childId) ?? 0;
    if (index < children.length - 1) {
      totalSpan += siblingGap;
    }
  });

  let cursorY = centerY - totalSpan / 2;
  for (const childId of children) {
    const childNode = nodeById.get(childId)!;
    const childSize = estimateNodeSize(childNode);
    const childSpan = spanCache.get(childId) ?? childSize.height;
    const childCenterY = cursorY + childSpan / 2;
    const gap = depth === 0 ? preset.mindmap!.rootGap : preset.mindmap!.levelGap;
    const childCenterX =
      centerX + side * (size.width / 2 + gap + childSize.width / 2);

    placeMindmapBranch(
      childId,
      childCenterX,
      childCenterY,
      side,
      nodeById,
      childrenById,
      preset,
      spanCache,
      positions,
      depth + 1
    );

    cursorY += childSpan + (depth === 0 ? branchGap : siblingGap);
  }
}

function buildCurvedRoute(
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  preset: ResolvedLayoutPreset
): StoredEdgeRoute {
  const sourceRect = getNodeRect(sourceNode);
  const targetRect = getNodeRect(targetNode);
  const dx = targetRect.centerX - sourceRect.centerX;
  const dy = targetRect.centerY - sourceRect.centerY;

  let sourceSide: EdgeRouteSide;
  let targetSide: EdgeRouteSide;
  if (Math.abs(dx) >= Math.abs(dy) * 0.55) {
    sourceSide = dx >= 0 ? "right" : "left";
    targetSide = dx >= 0 ? "left" : "right";
  } else {
    sourceSide = dy >= 0 ? "bottom" : "top";
    targetSide = dy >= 0 ? "top" : "bottom";
  }

  const sourceAnchor = anchorPoint(sourceRect, sourceSide);
  const targetAnchor = anchorPoint(targetRect, targetSide);
  const curveOffset = Math.max(
    preset.mindmap?.curveOffset ?? 72,
    Math.min(140, Math.abs(dx) * 0.28)
  );
  const controlA = offsetPoint(sourceAnchor, sourceSide, curveOffset);
  const controlB = offsetPoint(targetAnchor, targetSide, curveOffset);

  return {
    sourceSide,
    targetSide,
    style: "curved",
    points: [sourceAnchor, controlA, controlB, targetAnchor],
  };
}

function buildOrgTreeRoutes(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset
): Map<string, StoredEdgeRoute> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const routes = new Map<string, StoredEdgeRoute>();
  const portOffset = preset.orthogonalRouting.portOffset ?? 48;

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) continue;

    const sourceRect = getNodeRect(sourceNode);
    const targetRect = getNodeRect(targetNode);
    const targetBelow = targetRect.centerY >= sourceRect.centerY;
    const sourceSide: EdgeRouteSide = targetBelow ? "bottom" : "top";
    const targetSide: EdgeRouteSide = targetBelow ? "top" : "bottom";
    const sourceAnchor = anchorPoint(sourceRect, sourceSide);
    const targetAnchor = anchorPoint(targetRect, targetSide);
    const sourceOutside = offsetPoint(sourceAnchor, sourceSide, portOffset * 0.6);
    const targetOutside = offsetPoint(targetAnchor, targetSide, portOffset * 0.6);
    const laneY =
      sourceSide === "bottom"
        ? sourceOutside.y + Math.max(30, (targetOutside.y - sourceOutside.y) / 2)
        : sourceOutside.y - Math.max(30, (sourceOutside.y - targetOutside.y) / 2);

    routes.set(edge.id, {
      sourceSide,
      targetSide,
      style: "orthogonal",
      points: simplifyPoints([
        sourceAnchor,
        sourceOutside,
        { x: sourceOutside.x, y: laneY },
        { x: targetOutside.x, y: laneY },
        targetOutside,
        targetAnchor,
      ]),
    });
  }

  return routes;
}

function buildRoutesForPreset(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset,
  baseRoutes?: Map<string, StoredEdgeRoute>
): Map<string, StoredEdgeRoute> {
  if (edges.length === 0) return new Map();

  if (preset.kind === "mindmap") {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const routes = new Map<string, StoredEdgeRoute>();
    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) continue;
      routes.set(edge.id, buildCurvedRoute(source, target, preset));
    }
    return routes;
  }

  if (preset.kind === "org") {
    return buildOrgTreeRoutes(nodes, edges, preset);
  }

  const routes = new Map<string, StoredEdgeRoute>(baseRoutes ?? []);
  const missingEdges = edges.filter((edge) => !routes.has(edge.id));
  if (missingEdges.length === 0) {
    return routes;
  }

  const fallbackRoutes = computeOrthogonalEdgeRoutes(
    nodes,
    missingEdges,
    preset.direction,
    preset.orthogonalRouting
  );

  for (const [edgeId, route] of fallbackRoutes) {
    routes.set(edgeId, route);
  }

  return routes;
}

async function layoutMindmapComponent(
  component: GraphComponent,
  preset: ResolvedLayoutPreset
): Promise<PositionedComponent> {
  const rootId = selectCentralNode(component.nodes, component.edges);
  const { childrenById } = buildTraversalTree(component.nodes, component.edges, rootId);
  const nodeById = new Map(component.nodes.map((node) => [node.id, node]));
  const spanCache = new Map<string, number>();
  const positions = new Map<string, { x: number; y: number }>();

  const rootNode = nodeById.get(rootId)!;
  const rootSize = estimateNodeSize(rootNode);
  const firstLevel = childrenById.get(rootId) ?? [];
  const branchWeights = firstLevel.map((branchId) => ({
    id: branchId,
    span: measureTreeSpan(
      branchId,
      nodeById,
      childrenById,
      preset.mindmap!.siblingGap,
      spanCache
    ),
  }));

  const left: Array<{ id: string; span: number }> = [];
  const right: Array<{ id: string; span: number }> = [];
  let leftTotal = 0;
  let rightTotal = 0;

  for (const branch of branchWeights) {
    if (leftTotal <= rightTotal) {
      left.push(branch);
      leftTotal += branch.span;
    } else {
      right.push(branch);
      rightTotal += branch.span;
    }
  }

  positions.set(rootId, {
    x: -rootSize.width / 2,
    y: -rootSize.height / 2,
  });

  const placeSide = (
    branches: Array<{ id: string; span: number }>,
    side: -1 | 1
  ) => {
    if (branches.length === 0) return;

    const totalSpan =
      branches.reduce((sum, branch) => sum + branch.span, 0) +
      preset.mindmap!.branchGap * Math.max(0, branches.length - 1);
    let cursorY = -totalSpan / 2;

    for (const branch of branches) {
      const branchNode = nodeById.get(branch.id)!;
      const branchSize = estimateNodeSize(branchNode);
      const branchCenterY = cursorY + branch.span / 2;
      const branchCenterX =
        side *
        (rootSize.width / 2 +
          preset.mindmap!.rootGap +
          branchSize.width / 2);

      placeMindmapBranch(
        branch.id,
        branchCenterX,
        branchCenterY,
        side,
        nodeById,
        childrenById,
        preset,
        spanCache,
        positions
      );

      cursorY += branch.span + preset.mindmap!.branchGap;
    }
  };

  placeSide(left, -1);
  placeSide(right, 1);

  const laidNodes = applyPositionMap(component.nodes, positions);
  const routes = buildRoutesForPreset(laidNodes, component.edges, preset);
  return normalizeComponent({
    nodes: laidNodes,
    routes,
    bounds: computeBounds(laidNodes, routes),
  });
}

async function layoutDiagramComponent(
  component: GraphComponent,
  preset: ResolvedLayoutPreset
): Promise<PositionedComponent> {
  if (component.edges.length === 0) {
    const laidNodes = fallbackGridLayout(component.nodes, preset.direction);
    return normalizeComponent({
      nodes: laidNodes,
      routes: new Map(),
      bounds: computeBounds(laidNodes),
    });
  }

  const { nodes, routes } = await layoutWithElk(component.nodes, component.edges, preset);
  const allRoutes = buildRoutesForPreset(nodes, component.edges, preset, routes);
  return normalizeComponent({
    nodes,
    routes: allRoutes,
    bounds: computeBounds(nodes, allRoutes),
  });
}

async function layoutOrgComponent(
  component: GraphComponent,
  preset: ResolvedLayoutPreset
): Promise<PositionedComponent> {
  if (component.edges.length === 0) {
    const laidNodes = fallbackGridLayout(component.nodes, preset.direction);
    return normalizeComponent({
      nodes: laidNodes,
      routes: new Map(),
      bounds: computeBounds(laidNodes),
    });
  }

  const positioned = isOrgTreeLike(component.nodes, component.edges)
    ? await layoutWithElk(component.nodes, component.edges, preset)
    : {
        nodes: await dagreLayout(component.nodes, component.edges, preset.direction),
        routes: new Map<string, StoredEdgeRoute>(),
      };

  const routes = buildRoutesForPreset(
    positioned.nodes,
    component.edges,
    preset,
    undefined
  );

  return normalizeComponent({
    nodes: positioned.nodes,
    routes,
    bounds: computeBounds(positioned.nodes, routes),
  });
}

async function layoutComponent(
  component: GraphComponent,
  preset: ResolvedLayoutPreset
): Promise<PositionedComponent> {
  if (preset.kind === "mindmap") {
    return layoutMindmapComponent(component, preset);
  }
  if (preset.kind === "org") {
    return layoutOrgComponent(component, preset);
  }
  return layoutDiagramComponent(component, preset);
}

function packComponents(
  components: PositionedComponent[],
  preset: ResolvedLayoutPreset
): PositionedComponent[] {
  if (components.length <= 1) return components;

  const totalArea = components.reduce(
    (sum, component) =>
      sum +
      (component.bounds.width + preset.componentGap) *
        (component.bounds.height + preset.componentGap),
    0
  );
  const targetRowWidth = Math.max(
    ...components.map((component) => component.bounds.width),
    Math.sqrt(totalArea * preset.targetAspectRatio)
  );

  const packed: PositionedComponent[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const component of components) {
    if (
      cursorX > 0 &&
      cursorX + component.bounds.width > targetRowWidth &&
      rowHeight > 0
    ) {
      cursorX = 0;
      cursorY += rowHeight + preset.componentGap;
      rowHeight = 0;
    }

    const shiftedNodes = shiftNodes(component.nodes, cursorX, cursorY);
    const shiftedRoutes = new Map<string, StoredEdgeRoute>();
    for (const [edgeId, route] of component.routes) {
      shiftedRoutes.set(edgeId, shiftRoute(route, cursorX, cursorY));
    }

    const bounds = computeBounds(shiftedNodes, shiftedRoutes);
    packed.push({ nodes: shiftedNodes, routes: shiftedRoutes, bounds });

    cursorX += component.bounds.width + preset.componentGap;
    rowHeight = Math.max(rowHeight, component.bounds.height);
  }

  return packed;
}

async function layoutComponents(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset
): Promise<GraphLayoutResult> {
  const components = buildConnectedComponents(nodes, edges);
  const laidComponents: PositionedComponent[] = [];

  for (const component of components) {
    laidComponents.push(await layoutComponent(component, preset));
  }

  const packed = packComponents(laidComponents, preset);
  const positionedById = new Map<string, { x: number; y: number }>();
  const routes = new Map<string, StoredEdgeRoute>();

  for (const component of packed) {
    for (const node of component.nodes) {
      positionedById.set(node.id, node.position);
    }
    for (const [edgeId, route] of component.routes) {
      routes.set(edgeId, route);
    }
  }

  return {
    nodes: nodes.map((node) => ({
      ...node,
      position: positionedById.get(node.id) ?? node.position,
    })),
    routes,
    preset: preset.id,
    direction: preset.direction,
  };
}

async function incrementalLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  preset: ResolvedLayoutPreset,
  lockedNodeIds: Set<string>
): Promise<GraphLayoutResult> {
  const laidNodes = relaxLayoutFromCurrentPositions(nodes, edges, preset, {
    lockedNodeIds,
  });
  const routes = buildRoutesForPreset(laidNodes, edges, preset);

  return {
    nodes: laidNodes,
    routes,
    preset: preset.id,
    direction: preset.direction,
  };
}

export async function layoutGraph(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  options?: GraphLayoutOptions
): Promise<GraphLayoutResult> {
  if (nodes.length === 0) {
    const preset = resolvePreset(options);
    return {
      nodes,
      routes: new Map(),
      preset: preset.id,
      direction: preset.direction,
    };
  }

  const preset = resolvePreset(options);
  const lockedNodeIds =
    options?.lockedNodeIds instanceof Set
      ? options.lockedNodeIds
      : new Set(options?.lockedNodeIds ?? []);

  if (lockedNodeIds.size > 0) {
    return incrementalLayout(nodes, edges, preset, lockedNodeIds);
  }

  if (edges.length === 0) {
    const positionedNodes = hasMeaningfulPositions(nodes)
      ? relaxLayoutFromCurrentPositions(nodes, edges, preset)
      : fallbackGridLayout(nodes, preset.direction);
    return {
      nodes: positionedNodes,
      routes: new Map(),
      preset: preset.id,
      direction: preset.direction,
    };
  }

  if (options?.strategy === "RELAX" && hasMeaningfulPositions(nodes)) {
    return incrementalLayout(nodes, edges, preset, new Set());
  }

  return layoutComponents(nodes, edges, preset);
}

export async function autoLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  options?: {
    direction?: LayoutDirection;
    strategy?: AutoLayoutStrategy;
    lockedNodeIds?: string[] | Set<string>;
  }
): Promise<DiagramNode[]> {
  const result = await layoutGraph(nodes, edges, options);
  return result.nodes;
}

export function inferEdgeSidesFromNodes(
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  direction: LayoutDirection
): { sourceSide: EdgeRouteSide; targetSide: EdgeRouteSide } {
  return determineRelativeSides(getNodeRect(sourceNode), getNodeRect(targetNode), direction);
}

export function orthogonalizeStoredRoute(route: StoredEdgeRoute): StoredEdgeRoute {
  return {
    ...route,
    points: orthogonalizePath(route.points),
  };
}

export function pointsForCenteredAnchors(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  sourceSide: EdgeRouteSide,
  targetSide: EdgeRouteSide,
  corridor: EdgeRoutePoint[]
): EdgeRoutePoint[] {
  return simplifyPoints(
    orthogonalizePath([
      anchorPoint(sourceRect, sourceSide),
      ...corridor,
      anchorPoint(targetRect, targetSide),
    ])
  );
}
