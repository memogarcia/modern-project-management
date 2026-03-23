import type {
  ArchEdge,
  DiagramNode,
  ArchNodeData,
  DatabaseSchemaNodeData,
  TextNodeData,
} from "@/lib/types";
import { getShapeDef } from "@/lib/types";
import dagre from "dagre";
import ELK from "elkjs/lib/elk.bundled.js";

export type LayoutDirection = "DOWN" | "RIGHT";

export type AutoLayoutStrategy = "RELAX" | "ELK";

const DAGRE_DEFAULTS = {
  nodeSep: 120,
  rankSep: 180,
  edgeSep: 56,
  ranker: "network-simplex" as const,
};

const elk = new ELK();

export function estimateNodeSize(node: DiagramNode): { width: number; height: number } {
  const explicitW = typeof node.width === "number" ? node.width : undefined;
  const explicitH = typeof node.height === "number" ? node.height : undefined;
  const measuredW = typeof node.measured?.width === "number" ? node.measured.width : undefined;
  const measuredH = typeof node.measured?.height === "number" ? node.measured.height : undefined;

  if (typeof explicitW === "number" && typeof explicitH === "number") {
    return { width: explicitW, height: explicitH };
  }
  if (typeof measuredW === "number" && typeof measuredH === "number") {
    return { width: measuredW, height: measuredH };
  }

  if (node.type === "databaseSchemaNode") {
    const schema = (node.data as DatabaseSchemaNodeData).schema ?? [];
    return { width: 240, height: Math.max(80, 40 + schema.length * 24) };
  }

  if (node.type === "groupNode") {
    const style = (node.style ?? {}) as { width?: unknown; height?: unknown };
    const width = typeof style.width === "number" && Number.isFinite(style.width) ? style.width : 400;
    const height = typeof style.height === "number" && Number.isFinite(style.height) ? style.height : 300;
    return { width, height };
  }

  if (node.type === "textNode") {
    const text = ((node.data as TextNodeData).text ?? "").trim();
    const lines = Math.max(1, text.split("\n").length);
    const longest = Math.max(4, ...text.split("\n").map((l) => l.length));
    const width = Math.min(420, Math.max(80, 8 * longest + 16));
    const height = Math.max(32, 22 * lines + 12);
    return { width, height };
  }

  const shapeDef = getShapeDef((node.data as ArchNodeData).shapeType);
  return { width: shapeDef.defaultWidth, height: shapeDef.defaultHeight };
}

function fallbackGridLayout(nodes: DiagramNode[], direction: LayoutDirection): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  const sorted = [...nodes].sort((a, b) => {
    const dy = (a.position?.y ?? 0) - (b.position?.y ?? 0);
    if (dy !== 0) return dy;
    return (a.position?.x ?? 0) - (b.position?.x ?? 0);
  });

  const sizes = new Map<string, { w: number; h: number }>();
  let maxW = 0;
  let maxH = 0;
  for (const n of sorted) {
    const { width, height } = estimateNodeSize(n);
    sizes.set(n.id, { w: width, h: height });
    maxW = Math.max(maxW, width);
    maxH = Math.max(maxH, height);
  }

  const xGap = 120;
  const yGap = 90;

  const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));

  const gridW = maxW + xGap;
  const gridH = maxH + yGap;

  return sorted.map((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const x = direction === "RIGHT" ? col * gridW : row * gridW;
    const y = direction === "RIGHT" ? row * gridH : col * gridH;

    return {
      ...node,
      position: { x, y },
    };
  });
}

function stableHashInt(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
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

  for (const n of nodes) {
    const x = n.position?.x;
    const y = n.position?.y;
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
  if (spanX < 40 && spanY < 40) return false;
  return true;
}

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

function relaxLayoutFromCurrentPositions(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection,
  options?: {
    lockedNodeIds?: ReadonlySet<string>;
  }
): DiagramNode[] {
  if (nodes.length === 0) return nodes;

  const lockedNodeIds = options?.lockedNodeIds ?? new Set<string>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const neighborIds = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) continue;
    if (!neighborIds.has(e.source)) neighborIds.set(e.source, new Set());
    if (!neighborIds.has(e.target)) neighborIds.set(e.target, new Set());
    neighborIds.get(e.source)!.add(e.target);
    neighborIds.get(e.target)!.add(e.source);
  }

  const sizes = new Map<string, { w: number; h: number }>();
  for (const n of nodes) {
    const { width, height } = estimateNodeSize(n);
    sizes.set(n.id, { w: width, h: height });
  }

  const duplicateCount = new Map<string, number>();
  for (const n of nodes) {
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    const key = `${Math.round(x)}:${Math.round(y)}`;
    duplicateCount.set(key, (duplicateCount.get(key) ?? 0) + 1);
  }

  // Use the current centroid as a stable fallback for totally-unplaced nodes.
  let centroidX = 0;
  let centroidY = 0;
  for (const n of nodes) {
    centroidX += n.position?.x ?? 0;
    centroidY += n.position?.y ?? 0;
  }
  centroidX /= Math.max(1, nodes.length);
  centroidY /= Math.max(1, nodes.length);

  const sim: RelaxSimNode[] = nodes.map((n) => {
    const baseX = n.position?.x ?? 0;
    const baseY = n.position?.y ?? 0;
    const pinned = lockedNodeIds.has(n.id);
    const { w, h } = sizes.get(n.id)!;

    let x = baseX;
    let y = baseY;
    let anchorX = baseX;
    let anchorY = baseY;

    if (!pinned) {
      const key = `${Math.round(baseX)}:${Math.round(baseY)}`;
      const isDuplicate = (duplicateCount.get(key) ?? 0) > 1;
      const looksUnplaced = (baseX === 0 && baseY === 0) || isDuplicate;

      if (looksUnplaced) {
        const neighbors = neighborIds.get(n.id);
        let accX = 0;
        let accY = 0;
        let accN = 0;
        if (neighbors) {
          for (const nb of neighbors) {
            if (!lockedNodeIds.has(nb)) continue;
            const nbNode = byId.get(nb);
            if (!nbNode) continue;
            accX += nbNode.position?.x ?? 0;
            accY += nbNode.position?.y ?? 0;
            accN++;
          }
        }

        const seed = stableHashInt(n.id);
        const jitter = 24 + (seed % 16);
        const jx = ((seed & 1) === 0 ? -1 : 1) * jitter;
        const jy = ((seed & 2) === 0 ? -1 : 1) * jitter;

        if (accN > 0) {
          x = accX / accN + jx;
          y = accY / accN + jy;
        } else {
          x = centroidX + jx;
          y = centroidY + jy;
        }

        anchorX = x;
        anchorY = y;
      }
    }

    return { id: n.id, x, y, vx: 0, vy: 0, w, h, pinned, anchorX, anchorY };
  });

  const simById = new Map(sim.map((n) => [n.id, n]));

  const padding = 40;
  const iterations = 90;
  const damping = 0.78;
  const anchorStrength = lockedNodeIds.size > 0 ? 0.04 : 0.065;
  const linkStrength = 0.012;
  const linkDistance = direction === "RIGHT" ? 280 : 240;

  for (let iter = 0; iter < iterations; iter++) {
    // Collision / overlap resolution (O(n^2), fine for typical diagrams).
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
          const s = (stableHashInt(a.id + ":" + b.id) & 1) === 0 ? -1 : 1;
          dx = 0.01 * s;
          dy = 0.01 * -s;
        }

        const overlapX = (a.w + b.w) / 2 + padding - Math.abs(dx);
        const overlapY = (a.h + b.h) / 2 + padding - Math.abs(dy);
        if (overlapX <= 0 || overlapY <= 0) continue;

        // Resolve along the axis that requires less movement (preserves mental map better).
        if (overlapX < overlapY) {
          const push = (overlapX + 0.5) * (dx < 0 ? -1 : 1) * 0.55;
          if (!a.pinned) a.vx -= push;
          if (!b.pinned) b.vx += push;
        } else {
          const push = (overlapY + 0.5) * (dy < 0 ? -1 : 1) * 0.55;
          if (!a.pinned) a.vy -= push;
          if (!b.pinned) b.vy += push;
        }
      }
    }

    // Edge springs (gentle, to avoid re-arranging user layouts).
    for (const e of edges) {
      const a = simById.get(e.source);
      const b = simById.get(e.target);
      if (!a || !b) continue;

      const ax = a.x + a.w / 2;
      const ay = a.y + a.h / 2;
      const bx = b.x + b.w / 2;
      const by = b.y + b.h / 2;
      const dx = bx - ax;
      const dy = by - ay;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const delta = dist - linkDistance;
      const fx = (dx / dist) * delta * linkStrength;
      const fy = (dy / dist) * delta * linkStrength;

      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Anchor back towards original positions so the layout "breathes" rather than reflows.
    for (const n of sim) {
      if (n.pinned) continue;
      n.vx += (n.anchorX - n.x) * anchorStrength;
      n.vy += (n.anchorY - n.y) * anchorStrength;
    }

    for (const n of sim) {
      if (n.pinned) continue;
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  // Keep the overall diagram from drifting: align centroids of the movable set.
  let origMovableCx = 0;
  let origMovableCy = 0;
  let newMovableCx = 0;
  let newMovableCy = 0;
  let movableN = 0;
  for (const n of sim) {
    if (n.pinned) continue;
    const orig = byId.get(n.id);
    if (!orig) continue;
    origMovableCx += (orig.position?.x ?? 0) + n.w / 2;
    origMovableCy += (orig.position?.y ?? 0) + n.h / 2;
    newMovableCx += n.x + n.w / 2;
    newMovableCy += n.y + n.h / 2;
    movableN++;
  }
  if (movableN > 0) {
    const dx = origMovableCx / movableN - newMovableCx / movableN;
    const dy = origMovableCy / movableN - newMovableCy / movableN;
    for (const n of sim) {
      if (n.pinned) continue;
      n.x += dx;
      n.y += dy;
    }
  }

  const outById = new Map(sim.map((n) => [n.id, n]));
  return nodes.map((node) => {
    const s = outById.get(node.id);
    if (!s) return node;
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) return node;
    return { ...node, position: { x: s.x, y: s.y } };
  });
}

/**
 * Dagre remains as a deterministic fallback if ELK fails.
 */
function dagreLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection
): DiagramNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction === "DOWN" ? "TB" : "LR",
    nodesep: DAGRE_DEFAULTS.nodeSep,
    ranksep: DAGRE_DEFAULTS.rankSep,
    edgesep: DAGRE_DEFAULTS.edgeSep,
    ranker: DAGRE_DEFAULTS.ranker,
  });

  // Add nodes with estimated dimensions
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const { width, height } = estimateNodeSize(node);
    nodeDimensions.set(node.id, { width, height });
    g.setNode(node.id, { width, height });
  }

  // Add edges
  for (const edge of edges) {
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  // Compute layout
  try {
    dagre.layout(g);
  } catch {
    return fallbackGridLayout(nodes, direction);
  }

  // Apply computed positions (dagre gives center coords, convert to top-left)
  return nodes.map((node) => {
    const pos = g.node(node.id);
    const dim = nodeDimensions.get(node.id);
    if (pos && dim) {
      return {
        ...node,
        position: {
          x: pos.x - dim.width / 2,
          y: pos.y - dim.height / 2,
        },
      };
    }
    return node;
  });
}

async function elkLayout(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection
): Promise<DiagramNode[]> {
  const nodeDimensions = new Map<string, { width: number; height: number }>();
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction === "DOWN" ? "DOWN" : "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": "[top=56,left=56,bottom=56,right=56]",
      "elk.separateConnectedComponents": "true",
      "elk.spacing.nodeNode": "56",
      "elk.spacing.edgeNode": "42",
      "elk.spacing.edgeEdge": "26",
      "elk.spacing.componentComponent": "140",
      "elk.layered.spacing.baseValue": "48",
      "elk.layered.spacing.nodeNodeBetweenLayers": "160",
      "elk.layered.spacing.edgeNodeBetweenLayers": "64",
      "elk.layered.spacing.edgeEdgeBetweenLayers": "40",
      "elk.layered.nodePlacement.favorStraightEdges": "true",
      "elk.layered.unnecessaryBendpoints": "false",
      "elk.layered.compaction.connectedComponents": "true",
    },
    children: nodes.map((node) => {
      const { width, height } = estimateNodeSize(node);
      nodeDimensions.set(node.id, { width, height });
      return {
        id: node.id,
        width,
        height,
      };
    }),
    edges: edges
      .filter((edge) => nodeDimensions.has(edge.source) && nodeDimensions.has(edge.target))
      .map((edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      })),
  };

  try {
    const laidOut = await elk.layout(graph);
    const positionedChildren = new Map(
      (laidOut.children ?? [])
        .filter((child) => typeof child.x === "number" && typeof child.y === "number")
        .map((child) => [child.id, child] as const)
    );

    if (positionedChildren.size === 0) {
      return dagreLayout(nodes, edges, direction);
    }

    return nodes.map((node) => {
      const pos = positionedChildren.get(node.id);
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") {
        return node;
      }
      return {
        ...node,
        position: {
          x: pos.x,
          y: pos.y,
        },
      };
    });
  } catch {
    return dagreLayout(nodes, edges, direction);
  }
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
  if (nodes.length === 0) return nodes;

  const direction = options?.direction ?? "DOWN";
  const lockedNodeIds =
    options?.lockedNodeIds instanceof Set
      ? options.lockedNodeIds
      : new Set(options?.lockedNodeIds ?? []);

  // When some nodes must keep their positions (e.g. syncing Mermaid changes),
  // do a position-preserving relaxation so we can place the rest without
  // destroying the user's mental map.
  if (lockedNodeIds.size > 0) {
    return relaxLayoutFromCurrentPositions(nodes, edges, direction, { lockedNodeIds });
  }

  const strategy: AutoLayoutStrategy =
    options?.strategy ??
    (hasMeaningfulPositions(nodes) ? "RELAX" : "ELK");

  if (edges.length === 0) {
    // With no edges, the best we can do is de-overlap while keeping the current
    // arrangement. If positions are degenerate, fall back to a deterministic grid.
    if (!hasMeaningfulPositions(nodes)) return fallbackGridLayout(nodes, direction);
    return relaxLayoutFromCurrentPositions(nodes, edges, direction);
  }

  if (strategy === "ELK") {
    return elkLayout(nodes, edges, direction);
  }

  return relaxLayoutFromCurrentPositions(nodes, edges, direction);
}
