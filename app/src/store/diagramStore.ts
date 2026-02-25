import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
} from "@xyflow/react";
import { v4 as uuidv4 } from "uuid";
import type { ArchNode, ArchEdge, ShapeType, Diagram, DiagramNode, SchemaColumn, GroupNodeData, DatabaseSchemaNodeData } from "@/lib/types";
import { getShapeDef } from "@/lib/types";
import { flowToMermaid, mermaidToFlow, type MermaidSubgraph } from "@/lib/converters";
import { autoLayout } from "@/lib/layout";
import { saveDiagram, loadDiagram } from "@/lib/storage";

let persistQueue: Promise<void> = Promise.resolve();
let latestPersistRequest = 0;

type OverlapRect = { x: number; y: number; w: number; h: number };

function stripGroupingFromNode(node: DiagramNode): DiagramNode {
  const { parentId, extent, expandParent, ...rest } = node as DiagramNode & {
    parentId?: string;
    extent?: unknown;
    expandParent?: unknown;
  };
  return rest as DiagramNode;
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

  const GROUP_PADDING = 36;
  const GROUP_LABEL_HEIGHT = 28;
  const DEFAULT_GROUP_W = 360;
  const DEFAULT_GROUP_H = 240;

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

  // Graph state
  nodes: DiagramNode[];
  edges: ArchEdge[];
  mermaidCode: string;

  // Sync direction guard
  _syncingFromMermaid: boolean;
  _syncingFromFlow: boolean;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  loadDiagram: (id: string) => Promise<void>;
  initNewDiagram: (name: string, description?: string) => Promise<string>;
  setDiagramMeta: (name: string, description: string) => void;
  persist: () => void;

  addNode: (shapeType: ShapeType, position?: { x: number; y: number }) => void;
  addDatabaseSchemaNode: (tableName: string, columns: SchemaColumn[], position?: { x: number; y: number }) => void;
  addGroupNode: (label?: string, position?: { x: number; y: number }) => void;
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

  runAutoLayout: () => Promise<void>;
  setNodesAndEdges: (nodes: DiagramNode[], edges: ArchEdge[]) => void;
  resolveOverlapsForNode: (nodeId: string) => void;
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  diagramId: "",
  diagramName: "Untitled Diagram",
  diagramDescription: "",
  nodes: [],
  edges: [],
  mermaidCode: "graph TD\n",
  _syncingFromMermaid: false,
  _syncingFromFlow: false,

  onNodesChange: (changes) => {
    set((s) => {
      const newNodes = applyNodeChanges(changes, s.nodes) as DiagramNode[];
      return { nodes: newNodes };
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
      return { edges: newEdges };
    });
    if (!get()._syncingFromMermaid) {
      get().syncFlowToMermaid();
    }
  },

  onConnect: (connection) => {
    set((s) => ({
      edges: addEdge(
        { ...connection, type: "smoothstep", animated: false },
        s.edges
      ) as ArchEdge[],
    }));
    if (!get()._syncingFromMermaid) {
      get().syncFlowToMermaid();
    }
  },

  loadDiagram: async (id: string) => {
    const diagram = await loadDiagram(id);
    if (diagram) {
      set({
        diagramId: diagram.id,
        diagramName: diagram.name,
        diagramDescription: diagram.description,
        nodes: diagram.nodes as DiagramNode[],
        edges: diagram.edges as ArchEdge[],
        mermaidCode: diagram.mermaidCode,
      });
    }
  },

  initNewDiagram: async (name: string, description?: string) => {
    const id = uuidv4();
    const now = new Date().toISOString();
    const diagram: Diagram = {
      id,
      name,
      description: description ?? "",
      createdAt: now,
      updatedAt: now,
      nodes: [],
      edges: [],
      mermaidCode: "graph TD\n",
    };
    await saveDiagram(diagram);
    set({
      diagramId: id,
      diagramName: name,
      diagramDescription: description ?? "",
      nodes: [],
      edges: [],
      mermaidCode: "graph TD\n",
    });
    return id;
  },

  setDiagramMeta: (name, description) => {
    set({ diagramName: name, diagramDescription: description });
    get().persist();
  },

  persist: () => {
    const s = get();
    if (!s.diagramId) return;

    const requestId = ++latestPersistRequest;
    const snapshot = {
      diagramId: s.diagramId,
      diagramName: s.diagramName,
      diagramDescription: s.diagramDescription,
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

        const diagram: Diagram = {
          id: snapshot.diagramId,
          name: snapshot.diagramName,
          description: snapshot.diagramDescription,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          nodes: snapshot.nodes,
          edges: snapshot.edges,
          mermaidCode: snapshot.mermaidCode,
        };

        await saveDiagram(diagram);
      })
      .catch(() => undefined);
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
      return { nodes: [...s.nodes, { ...baseNode, position: freeAbs }] };
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
      return { nodes: [...s.nodes, { ...baseNode, position: freeAbs }] };
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
    set((s) => ({ nodes: [...s.nodes, newNode] }));
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

      return {
        nodes: s.nodes.filter((n) => !n.selected),
        edges: s.edges.filter(
          (e) =>
            !e.selected &&
            !deletedNodeIds.has(e.source) &&
            !deletedNodeIds.has(e.target)
        ),
      };
    });
    get().syncFlowToMermaid();
  },

  updateNodeData: (nodeId, data) => {
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } as typeof n : n
      ),
    }));
    get().syncFlowToMermaid();
  },

  updateEdge: (edgeId, updates) => {
    set((s) => ({
      edges: s.edges.map((e) => {
        if (e.id !== edgeId) return e;
        const merged: ArchEdge = {
          ...e,
          ...updates,
          data: { ...e.data, ...updates.data },
        };
        return merged;
      }),
    }));
    get().syncFlowToMermaid();
  },

  updateMermaidCode: (code) => {
    set({ mermaidCode: code });
  },

  syncFlowToMermaid: () => {
    const s = get();
    if (s._syncingFromMermaid) return;
    set({ _syncingFromFlow: true });
    const code = flowToMermaid(s.nodes, s.edges);
    set({ mermaidCode: code, _syncingFromFlow: false });
  },

  syncMermaidToFlow: async () => {
    const s = get();
    if (s._syncingFromFlow) return;
    set({ _syncingFromMermaid: true });
    try {
      const { nodes: parsedNodes, edges: parsedEdges, subgraphs } = mermaidToFlow(
        s.mermaidCode,
        s.nodes, // pass existing nodes so visual metadata (shapeType, etc.) is preserved
      );
      // Preserve positions for nodes that already exist
      const absPosMap = buildAbsolutePositionMap(s.nodes);
      const needsLayout: DiagramNode[] = [];
      const merged = parsedNodes.map((n) => {
        const existingAbs = absPosMap.get(n.id);
        const stripped = stripGroupingFromNode(n);
        if (existingAbs) {
          return { ...stripped, position: existingAbs };
        }
        needsLayout.push(stripped);
        return stripped;
      });

      let finalNodes = merged;
      if (needsLayout.length > 0) {
        finalNodes = await autoLayout(merged, parsedEdges);
      }
      finalNodes = applyMermaidSubgraphGroups(finalNodes, subgraphs);

      // Preserve existing edge objects when source/target/label haven't changed
      // so React Flow doesn't re-route them.
      const existingEdgeMap = new Map(s.edges.map((e) => [e.id, e]));
      const mergedEdges = parsedEdges.map((pe) => {
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

      set({
        nodes: finalNodes,
        edges: mergedEdges,
        _syncingFromMermaid: false,
      });
    } catch {
      set({ _syncingFromMermaid: false });
    }
  },

  runAutoLayout: async () => {
    const s = get();
    if (s.nodes.length === 0) return;

    const hasGroups = s.nodes.some((n) => n.type === "groupNode");
    if (!hasGroups) {
      const laid = await autoLayout(s.nodes, s.edges);
      set({ nodes: laid });
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

    const laidFlatNodes = await autoLayout(flatNodes, flatEdges);
    const rebuilt = applyMermaidSubgraphGroups(laidFlatNodes, subgraphs, {
      preserveGroupIds: true,
      groupTemplates: templates,
    });
    set({ nodes: rebuilt });
  },

  setNodesAndEdges: (nodes, edges) => {
    set({ nodes, edges });
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
