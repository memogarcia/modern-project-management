import type { ArchEdge, DiagramNode } from "@/lib/types";
import { estimateNodeSize, type LayoutDirection } from "@/lib/layout";

export type EdgeRouteSide = "top" | "right" | "bottom" | "left";

export type EdgeRoutePoint = {
  x: number;
  y: number;
};

export type OrthogonalEdgeRoute = {
  sourceSide: EdgeRouteSide;
  targetSide: EdgeRouteSide;
  points: EdgeRoutePoint[];
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type Cell = {
  col: number;
  row: number;
};

type DirIndex = 0 | 1 | 2 | 3;

type SearchState = {
  key: string;
  cell: Cell;
  dir: DirIndex;
  score: number;
  priority: number;
};

const GRID_SIZE = 20;
const NODE_PADDING = 26;
const PORT_OFFSET = 40;
const SEARCH_MARGIN = 140;
const MAX_SEARCH_CELLS = 22000;
const ROUTE_VERSION = 1;
const DIRS: Array<{ dx: number; dy: number; side: EdgeRouteSide }> = [
  { dx: 0, dy: -1, side: "top" },
  { dx: 1, dy: 0, side: "right" },
  { dx: 0, dy: 1, side: "bottom" },
  { dx: -1, dy: 0, side: "left" },
];

function roundPoint(point: EdgeRoutePoint): EdgeRoutePoint {
  return {
    x: Math.round(point.x * 100) / 100,
    y: Math.round(point.y * 100) / 100,
  };
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

function pointInRect(point: EdgeRoutePoint, rect: Rect): boolean {
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function toRect(node: DiagramNode): Rect {
  const { width, height } = estimateNodeSize(node);
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + width,
    bottom: node.position.y + height,
  };
}

function rectCenter(rect: Rect): EdgeRoutePoint {
  return {
    x: (rect.left + rect.right) / 2,
    y: (rect.top + rect.bottom) / 2,
  };
}

function anchorPoint(rect: Rect, side: EdgeRouteSide): EdgeRoutePoint {
  switch (side) {
    case "top":
      return { x: (rect.left + rect.right) / 2, y: rect.top };
    case "right":
      return { x: rect.right, y: (rect.top + rect.bottom) / 2 };
    case "bottom":
      return { x: (rect.left + rect.right) / 2, y: rect.bottom };
    case "left":
      return { x: rect.left, y: (rect.top + rect.bottom) / 2 };
  }
}

function offsetPoint(point: EdgeRoutePoint, side: EdgeRouteSide, offset: number): EdgeRoutePoint {
  switch (side) {
    case "top":
      return { x: point.x, y: point.y - offset };
    case "right":
      return { x: point.x + offset, y: point.y };
    case "bottom":
      return { x: point.x, y: point.y + offset };
    case "left":
      return { x: point.x - offset, y: point.y };
  }
}

function preferredSourceSides(dx: number, dy: number, direction: LayoutDirection): EdgeRouteSide[] {
  const byDistance: EdgeRouteSide[] =
    Math.abs(dx) >= Math.abs(dy)
      ? [dx >= 0 ? "right" : "left", dy >= 0 ? "bottom" : "top", dy >= 0 ? "top" : "bottom", dx >= 0 ? "left" : "right"]
      : [dy >= 0 ? "bottom" : "top", dx >= 0 ? "right" : "left", dx >= 0 ? "left" : "right", dy >= 0 ? "top" : "bottom"];

  if (direction === "RIGHT") {
    return Array.from(new Set(["right", ...byDistance]));
  }
  return Array.from(new Set(["bottom", ...byDistance]));
}

function preferredTargetSides(dx: number, dy: number, direction: LayoutDirection): EdgeRouteSide[] {
  const byDistance: EdgeRouteSide[] =
    Math.abs(dx) >= Math.abs(dy)
      ? [dx >= 0 ? "left" : "right", dy >= 0 ? "top" : "bottom", dy >= 0 ? "bottom" : "top", dx >= 0 ? "right" : "left"]
      : [dy >= 0 ? "top" : "bottom", dx >= 0 ? "left" : "right", dx >= 0 ? "right" : "left", dy >= 0 ? "bottom" : "top"];

  if (direction === "RIGHT") {
    return Array.from(new Set(["left", ...byDistance]));
  }
  return Array.from(new Set(["top", ...byDistance]));
}

function buildBounds(rects: Rect[], points: EdgeRoutePoint[]): Rect {
  const xs = [
    ...rects.flatMap((rect) => [rect.left, rect.right]),
    ...points.map((point) => point.x),
  ];
  const ys = [
    ...rects.flatMap((rect) => [rect.top, rect.bottom]),
    ...points.map((point) => point.y),
  ];

  return {
    left: Math.min(...xs) - SEARCH_MARGIN,
    top: Math.min(...ys) - SEARCH_MARGIN,
    right: Math.max(...xs) + SEARCH_MARGIN,
    bottom: Math.max(...ys) + SEARCH_MARGIN,
  };
}

function snapToCell(point: EdgeRoutePoint, bounds: Rect): Cell {
  return {
    col: Math.round((point.x - bounds.left) / GRID_SIZE),
    row: Math.round((point.y - bounds.top) / GRID_SIZE),
  };
}

function cellCenter(cell: Cell, bounds: Rect): EdgeRoutePoint {
  return {
    x: bounds.left + cell.col * GRID_SIZE,
    y: bounds.top + cell.row * GRID_SIZE,
  };
}

function cellKey(cell: Cell): string {
  return `${cell.col}:${cell.row}`;
}

function stateKey(cell: Cell, dir: DirIndex): string {
  return `${cell.col}:${cell.row}:${dir}`;
}

function cellDistance(a: Cell, b: Cell): number {
  return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
}

function oppositeDir(dir: DirIndex): DirIndex {
  return ((dir + 2) % 4) as DirIndex;
}

function simplifyPoints(points: EdgeRoutePoint[]): EdgeRoutePoint[] {
  const rounded = points.map(roundPoint);
  const deduped: EdgeRoutePoint[] = [];

  for (const point of rounded) {
    const previous = deduped[deduped.length - 1];
    if (previous && previous.x === point.x && previous.y === point.y) {
      continue;
    }
    deduped.push(point);
  }

  const out: EdgeRoutePoint[] = [];
  for (const point of deduped) {
    if (out.length < 2) {
      out.push(point);
      continue;
    }

    const prev = out[out.length - 1]!;
    const prevPrev = out[out.length - 2]!;
    const sameX = prevPrev.x === prev.x && prev.x === point.x;
    const sameY = prevPrev.y === prev.y && prev.y === point.y;

    if (sameX || sameY) {
      out[out.length - 1] = point;
      continue;
    }

    out.push(point);
  }

  return out;
}

function routeCellsToPoints(cells: Cell[], bounds: Rect): EdgeRoutePoint[] {
  return cells.map((cell) => cellCenter(cell, bounds));
}

function routeSignature(points: EdgeRoutePoint[]): string[] {
  const cells: string[] = [];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!;
    const b = points[index]!;

    if (a.x === b.x) {
      const step = a.y <= b.y ? GRID_SIZE : -GRID_SIZE;
      for (let y = a.y; step > 0 ? y <= b.y : y >= b.y; y += step) {
        cells.push(`${Math.round(a.x / GRID_SIZE)}:${Math.round(y / GRID_SIZE)}`);
      }
    } else if (a.y === b.y) {
      const step = a.x <= b.x ? GRID_SIZE : -GRID_SIZE;
      for (let x = a.x; step > 0 ? x <= b.x : x >= b.x; x += step) {
        cells.push(`${Math.round(x / GRID_SIZE)}:${Math.round(a.y / GRID_SIZE)}`);
      }
    }
  }
  return cells;
}

function sidePenalty(side: EdgeRouteSide, preferred: EdgeRouteSide[]): number {
  const index = preferred.indexOf(side);
  return index < 0 ? 6 : index * 1.2;
}

function mainFlowPenalty(dir: DirIndex, direction: LayoutDirection): number {
  if (direction === "RIGHT" && dir === 3) return 0.9;
  if (direction === "DOWN" && dir === 0) return 0.9;
  return 0;
}

function occupancyPenalty(point: EdgeRoutePoint, occupied: Map<string, number>): number {
  const key = `${Math.round(point.x / GRID_SIZE)}:${Math.round(point.y / GRID_SIZE)}`;
  return (occupied.get(key) ?? 0) * 0.55;
}

function countTurns(points: EdgeRoutePoint[]): number {
  let turns = 0;
  for (let index = 2; index < points.length; index++) {
    const a = points[index - 2]!;
    const b = points[index - 1]!;
    const c = points[index]!;
    const abx = Math.sign(b.x - a.x);
    const aby = Math.sign(b.y - a.y);
    const bcx = Math.sign(c.x - b.x);
    const bcy = Math.sign(c.y - b.y);
    if (abx !== bcx || aby !== bcy) {
      turns++;
    }
  }
  return turns;
}

function scorePoints(
  points: EdgeRoutePoint[],
  occupied: Map<string, number>,
  direction: LayoutDirection,
  sourceSide: EdgeRouteSide,
  targetSide: EdgeRouteSide,
  preferredSources: EdgeRouteSide[],
  preferredTargets: EdgeRouteSide[]
): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;

  let length = 0;
  for (let index = 1; index < points.length; index++) {
    const prev = points[index - 1]!;
    const next = points[index]!;
    length += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y);
  }

  const occupancy = points.reduce((sum, point) => sum + occupancyPenalty(point, occupied), 0);
  return (
    length +
    countTurns(points) * 42 +
    occupancy * 14 +
    sidePenalty(sourceSide, preferredSources) * 28 +
    sidePenalty(targetSide, preferredTargets) * 28 +
    (direction === "RIGHT" && sourceSide === "left" ? 64 : 0) +
    (direction === "DOWN" && sourceSide === "top" ? 64 : 0)
  );
}

function aStarRoute(
  start: Cell,
  goal: Cell,
  bounds: Rect,
  blocked: (cell: Cell) => boolean,
  occupied: Map<string, number>,
  direction: LayoutDirection,
  initialDir: DirIndex,
  finalDir: DirIndex
): Cell[] | null {
  const open: SearchState[] = [
    {
      key: stateKey(start, initialDir),
      cell: start,
      dir: initialDir,
      score: 0,
      priority: cellDistance(start, goal),
    },
  ];
  const best = new Map<string, number>([[stateKey(start, initialDir), 0]]);
  const cameFrom = new Map<string, string>();
  const cellBounds = {
    minCol: Math.floor((bounds.left - bounds.left) / GRID_SIZE),
    minRow: Math.floor((bounds.top - bounds.top) / GRID_SIZE),
    maxCol: Math.ceil((bounds.right - bounds.left) / GRID_SIZE),
    maxRow: Math.ceil((bounds.bottom - bounds.top) / GRID_SIZE),
  };

  let explored = 0;
  while (open.length > 0 && explored < MAX_SEARCH_CELLS) {
    open.sort((a, b) => a.priority - b.priority);
    const current = open.shift()!;
    explored++;

    if (current.cell.col === goal.col && current.cell.row === goal.row) {
      let cursor = current.key;
      const route: Cell[] = [];
      while (cursor) {
        const [col, row] = cursor.split(":").map(Number);
        route.push({ col, row });
        const prev = cameFrom.get(cursor);
        if (!prev) break;
        cursor = prev;
      }
      return route.reverse();
    }

    for (let dir = 0 as DirIndex; dir < DIRS.length; dir = (dir + 1) as DirIndex) {
      const def = DIRS[dir];
      const next: Cell = {
        col: current.cell.col + def.dx,
        row: current.cell.row + def.dy,
      };

      if (
        next.col < cellBounds.minCol ||
        next.row < cellBounds.minRow ||
        next.col > cellBounds.maxCol ||
        next.row > cellBounds.maxRow
      ) {
        continue;
      }

      if (blocked(next) && !(next.col === goal.col && next.row === goal.row)) {
        continue;
      }

      const nextPoint = cellCenter(next, bounds);
      const turnPenalty = current.dir === dir ? 0 : 0.85;
      const reversePenalty = current.dir === oppositeDir(dir) ? 0.95 : 0;
      const endPenalty = next.col === goal.col && next.row === goal.row && dir !== finalDir ? 0.6 : 0;
      const nextScore =
        current.score +
        1 +
        turnPenalty +
        reversePenalty +
        mainFlowPenalty(dir, direction) +
        occupancyPenalty(nextPoint, occupied) * 0.28 +
        endPenalty;
      const nextKey = stateKey(next, dir);

      if (nextScore >= (best.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      best.set(nextKey, nextScore);
      cameFrom.set(nextKey, current.key);
      open.push({
        key: nextKey,
        cell: next,
        dir,
        score: nextScore,
        priority: nextScore + cellDistance(next, goal),
      });
    }
  }

  return null;
}

function directOrthogonalFallback(
  sourceAnchor: EdgeRoutePoint,
  sourceOutside: EdgeRoutePoint,
  targetOutside: EdgeRoutePoint,
  targetAnchor: EdgeRoutePoint,
  direction: LayoutDirection
): EdgeRoutePoint[] {
  const points = [sourceAnchor, sourceOutside];

  if (sourceOutside.x === targetOutside.x || sourceOutside.y === targetOutside.y) {
    points.push(targetOutside, targetAnchor);
    return simplifyPoints(points);
  }

  if (direction === "RIGHT") {
    const midX = Math.round((sourceOutside.x + targetOutside.x) / 2 / GRID_SIZE) * GRID_SIZE;
    points.push(
      { x: midX, y: sourceOutside.y },
      { x: midX, y: targetOutside.y }
    );
  } else {
    const midY = Math.round((sourceOutside.y + targetOutside.y) / 2 / GRID_SIZE) * GRID_SIZE;
    points.push(
      { x: sourceOutside.x, y: midY },
      { x: targetOutside.x, y: midY }
    );
  }

  points.push(targetOutside, targetAnchor);
  return simplifyPoints(points);
}

function buildBlockedCellChecker(bounds: Rect, obstacles: Rect[]): (cell: Cell) => boolean {
  const cache = new Map<string, boolean>();

  return (cell: Cell) => {
    const key = cellKey(cell);
    const cached = cache.get(key);
    if (cached != null) return cached;

    const center = cellCenter(cell, bounds);
    const blocked = obstacles.some((rect) => pointInRect(center, rect));
    cache.set(key, blocked);
    return blocked;
  };
}

function buildRouteForSides(
  sourceRect: Rect,
  targetRect: Rect,
  sourceSide: EdgeRouteSide,
  targetSide: EdgeRouteSide,
  obstacles: Rect[],
  occupied: Map<string, number>,
  direction: LayoutDirection,
  preferredSources: EdgeRouteSide[],
  preferredTargets: EdgeRouteSide[]
): OrthogonalEdgeRoute {
  const sourceAnchor = anchorPoint(sourceRect, sourceSide);
  const targetAnchor = anchorPoint(targetRect, targetSide);
  const sourceOutside = offsetPoint(sourceAnchor, sourceSide, PORT_OFFSET);
  const targetOutside = offsetPoint(targetAnchor, targetSide, PORT_OFFSET);
  const bounds = buildBounds(obstacles, [sourceAnchor, sourceOutside, targetOutside, targetAnchor]);
  const blocked = buildBlockedCellChecker(bounds, obstacles);
  const startCell = snapToCell(sourceOutside, bounds);
  const goalCell = snapToCell(targetOutside, bounds);
  const startDir = DIRS.findIndex((dir) => dir.side === sourceSide) as DirIndex;
  const endDir = DIRS.findIndex((dir) => dir.side === targetSide) as DirIndex;
  const cellRoute = aStarRoute(startCell, goalCell, bounds, blocked, occupied, direction, startDir, endDir);

  const routed =
    cellRoute && cellRoute.length > 0
      ? simplifyPoints([
          sourceAnchor,
          sourceOutside,
          ...routeCellsToPoints(cellRoute, bounds),
          targetOutside,
          targetAnchor,
        ])
      : directOrthogonalFallback(sourceAnchor, sourceOutside, targetOutside, targetAnchor, direction);

  const score = scorePoints(routed, occupied, direction, sourceSide, targetSide, preferredSources, preferredTargets);

  return {
    sourceSide,
    targetSide,
    points: routed,
    score,
  } as OrthogonalEdgeRoute & { score: number };
}

function routeEdge(
  edge: ArchEdge,
  rectById: Map<string, Rect>,
  allExpandedRects: Rect[],
  occupied: Map<string, number>,
  direction: LayoutDirection
): OrthogonalEdgeRoute | null {
  if (edge.source === edge.target) return null;

  const sourceRect = rectById.get(edge.source);
  const targetRect = rectById.get(edge.target);
  if (!sourceRect || !targetRect) return null;

  const sourceCenter = rectCenter(sourceRect);
  const targetCenter = rectCenter(targetRect);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const preferredSources = preferredSourceSides(dx, dy, direction);
  const preferredTargets = preferredTargetSides(dx, dy, direction);
  const candidateSources = preferredSources.slice(0, 3);
  const candidateTargets = preferredTargets.slice(0, 3);

  let best: (OrthogonalEdgeRoute & { score: number }) | null = null;
  for (const sourceSide of candidateSources) {
    for (const targetSide of candidateTargets) {
      const candidate = buildRouteForSides(
        sourceRect,
        targetRect,
        sourceSide,
        targetSide,
        allExpandedRects,
        occupied,
        direction,
        preferredSources,
        preferredTargets
      ) as OrthogonalEdgeRoute & { score: number };

      if (!best || candidate.score < best.score) {
        best = candidate;
      }
    }
  }

  if (!best) return null;
  return {
    sourceSide: best.sourceSide,
    targetSide: best.targetSide,
    points: best.points,
  };
}

function stableEdgeOrder(edges: ArchEdge[], rectById: Map<string, Rect>): ArchEdge[] {
  return [...edges].sort((a, b) => {
    const aSource = rectById.get(a.source);
    const bSource = rectById.get(b.source);
    const aTarget = rectById.get(a.target);
    const bTarget = rectById.get(b.target);

    const aSpan = aSource && aTarget ? Math.abs(rectCenter(aTarget).x - rectCenter(aSource).x) + Math.abs(rectCenter(aTarget).y - rectCenter(aSource).y) : 0;
    const bSpan = bSource && bTarget ? Math.abs(rectCenter(bTarget).x - rectCenter(bSource).x) + Math.abs(rectCenter(bTarget).y - rectCenter(bSource).y) : 0;
    if (aSpan !== bSpan) return bSpan - aSpan;
    return a.id.localeCompare(b.id);
  });
}

export function computeOrthogonalEdgeRoutes(
  nodes: DiagramNode[],
  edges: ArchEdge[],
  direction: LayoutDirection
): Map<string, OrthogonalEdgeRoute> {
  const routes = new Map<string, OrthogonalEdgeRoute>();
  if (nodes.length === 0 || edges.length === 0) return routes;

  const rectById = new Map(nodes.map((node) => [node.id, toRect(node)]));
  const expandedRects = nodes.map((node) => expandRect(toRect(node), NODE_PADDING));
  const occupied = new Map<string, number>();

  for (const edge of stableEdgeOrder(edges, rectById)) {
    const route = routeEdge(edge, rectById, expandedRects, occupied, direction);
    if (!route) continue;

    routes.set(edge.id, route);
    for (const cell of routeSignature(route.points)) {
      occupied.set(cell, (occupied.get(cell) ?? 0) + 1);
    }
  }

  return routes;
}

export function readStoredEdgeRoute(edge: ArchEdge): OrthogonalEdgeRoute | null {
  const value = edge.data?.layoutRoute;
  if (!value || typeof value !== "object") return null;

  const route = value as {
    version?: unknown;
    sourceSide?: unknown;
    targetSide?: unknown;
    points?: unknown;
  };

  if (route.version !== ROUTE_VERSION) return null;
  if (!Array.isArray(route.points) || route.points.length < 2) return null;
  if (!["top", "right", "bottom", "left"].includes(String(route.sourceSide))) return null;
  if (!["top", "right", "bottom", "left"].includes(String(route.targetSide))) return null;

  const points = route.points
    .map((point) => {
      if (!point || typeof point !== "object") return null;
      const value = point as { x?: unknown; y?: unknown };
      if (typeof value.x !== "number" || typeof value.y !== "number") return null;
      if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
      return roundPoint({ x: value.x, y: value.y });
    })
    .filter((point): point is EdgeRoutePoint => point !== null);

  if (points.length < 2) return null;

  return {
    sourceSide: route.sourceSide as EdgeRouteSide,
    targetSide: route.targetSide as EdgeRouteSide,
    points: simplifyPoints(points),
  };
}

export function writeStoredEdgeRoute(
  data: ArchEdge["data"] | undefined,
  route: OrthogonalEdgeRoute | null
): ArchEdge["data"] | undefined {
  const nextData = { ...(data ?? {}) } as Record<string, unknown>;
  if (!route) {
    delete nextData.layoutRoute;
    return Object.keys(nextData).length > 0 ? nextData : undefined;
  }

  nextData.layoutRoute = {
    version: ROUTE_VERSION,
    sourceSide: route.sourceSide,
    targetSide: route.targetSide,
    points: route.points.map(roundPoint),
  };
  return nextData as ArchEdge["data"];
}
