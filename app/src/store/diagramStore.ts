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
import type { ArchNode, ArchEdge, ShapeType, Diagram, DiagramNode, SchemaColumn, GroupNodeData } from "@/lib/types";
import { getShapeDef } from "@/lib/types";
import { flowToMermaid, mermaidToFlow } from "@/lib/converters";
import { autoLayout } from "@/lib/layout";
import { saveDiagram, loadDiagram } from "@/lib/storage";

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
  syncMermaidToFlow: () => void;

  runAutoLayout: () => Promise<void>;
  setNodesAndEdges: (nodes: DiagramNode[], edges: ArchEdge[]) => void;
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
    // Fire-and-forget the async save — persist is called frequently (on every drag etc.)
    // so we don't want to await; the API serialises writes per-file anyway.
    loadDiagram(s.diagramId).then((existing) => {
      const diagram: Diagram = {
        id: s.diagramId,
        name: s.diagramName,
        description: s.diagramDescription,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes: s.nodes as unknown[],
        edges: s.edges as unknown[],
        mermaidCode: s.mermaidCode,
      };
      saveDiagram(diagram);
    });
  },

  addNode: (shapeType, position) => {
    const shapeDef = getShapeDef(shapeType);
    const id = `${shapeType}_${uuidv4().slice(0, 8)}`;
    const newNode: ArchNode = {
      id,
      type: "archNode",
      position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        label: shapeDef.label,
        shapeType,
        description: "",
      },
    };
    set((s) => ({ nodes: [...s.nodes, newNode] }));
    get().syncFlowToMermaid();
  },

  addDatabaseSchemaNode: (tableName, columns, position) => {
    const id = `table_${tableName.toLowerCase().replace(/\s+/g, "_")}_${uuidv4().slice(0, 8)}`;
    const newNode: DiagramNode = {
      id,
      type: "databaseSchemaNode",
      position: position ?? { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        label: tableName,
        schema: columns,
      },
    };
    set((s) => ({ nodes: [...s.nodes, newNode] }));
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
    set((s) => ({
      nodes: s.nodes.filter((n) => !n.selected),
      edges: s.edges.filter((e) => !e.selected),
    }));
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
      const { nodes: parsedNodes, edges: parsedEdges } = mermaidToFlow(
        s.mermaidCode,
        s.nodes, // pass existing nodes so visual metadata (shapeType, etc.) is preserved
      );
      // Preserve positions for nodes that already exist
      const posMap = new Map(s.nodes.map((n) => [n.id, n.position]));
      const needsLayout: DiagramNode[] = [];
      const merged = parsedNodes.map((n) => {
        const existing = posMap.get(n.id);
        if (existing) {
          return { ...n, position: existing };
        }
        needsLayout.push(n);
        return n;
      });

      let finalNodes = merged;
      if (needsLayout.length > 0) {
        finalNodes = await autoLayout(merged, parsedEdges);
      }

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
    const laid = await autoLayout(s.nodes, s.edges);
    set({ nodes: laid });
  },

  setNodesAndEdges: (nodes, edges) => {
    set({ nodes, edges });
    get().syncFlowToMermaid();
  },
}));
