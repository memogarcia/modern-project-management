"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  type ReactFlowInstance,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnNodeDrag,
  BackgroundVariant,
  useReactFlow,
  type InternalNode,
} from "@xyflow/react";
import { PanelRightOpen } from "lucide-react";
import { useDiagramStore } from "@/store/diagramStore";
import { useTheme } from "@/components/ThemeProvider";
import { nodeTypes } from "@/components/nodes";
import ShapePalette from "@/components/ShapePalette";
import MermaidPanel from "@/components/MermaidPanel";
import Toolbar from "@/components/Toolbar";
import NodeEditModal from "@/components/NodeEditModal";
import EdgeEditModal from "@/components/EdgeEditModal";
import type { ShapeType, ArchNode, ArchEdge } from "@/lib/types";

interface DiagramEditorProps {
  diagramId: string;
}

export default function DiagramEditor({ diagramId }: DiagramEditorProps) {
  const { theme } = useTheme();
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const onNodesChange = useDiagramStore((s) => s.onNodesChange);
  const onEdgesChange = useDiagramStore((s) => s.onEdgesChange);
  const onConnect = useDiagramStore((s) => s.onConnect);
  const addNode = useDiagramStore((s) => s.addNode);
  const currentDiagramId = useDiagramStore((s) => s.diagramId);
  const diagramName = useDiagramStore((s) => s.diagramName);
  const isDiagramLoading = useDiagramStore((s) => s.isLoading);
  const diagramLoadError = useDiagramStore((s) => s.loadError);
  const diagramPersistError = useDiagramStore((s) => s.persistError);
  const loadDiagramFn = useDiagramStore((s) => s.loadDiagram);
  const mermaidCode = useDiagramStore((s) => s.mermaidCode);
  const syncMermaidToFlow = useDiagramStore((s) => s.syncMermaidToFlow);
  const persist = useDiagramStore((s) => s.persist);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const copySelected = useDiagramStore((s) => s.copySelected);
  const cutSelected = useDiagramStore((s) => s.cutSelected);
  const pasteClipboard = useDiagramStore((s) => s.pasteClipboard);
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const groupSelectedNodes = useDiagramStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useDiagramStore((s) => s.ungroupSelectedNodes);
  const runAutoLayout = useDiagramStore((s) => s.runAutoLayout);
  const reparentNode = useDiagramStore((s) => s.reparentNode);
  const resolveOverlapsForNode = useDiagramStore((s) => s.resolveOverlapsForNode);
  const sendToFront = useDiagramStore((s) => s.sendToFront);
  const sendToBack = useDiagramStore((s) => s.sendToBack);
  const sendForward = useDiagramStore((s) => s.sendForward);
  const sendBackward = useDiagramStore((s) => s.sendBackward);
  const { getInternalNode, getNodes, screenToFlowPosition, fitView } = useReactFlow();

  // Modal state for editing nodes and edges
  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const [editingEdge, setEditingEdge] = useState<ArchEdge | null>(null);
  const [hasRequestedLoad, setHasRequestedLoad] = useState(false);

  // ─── Resizable Mermaid panel ──────────────────────────────────────
  const widthStorageKey = "archdiagram.mermaid.width";
  const collapsedStorageKey = "archdiagram.mermaid.collapsed";

  const [panelWidth, setPanelWidth] = useState(380);
  const panelWidthRef = useRef(380);
  const lastExpandedWidthRef = useRef(380);
  const [isMermaidCollapsed, setIsMermaidCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(380);
  const lastPointerFlowPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    panelWidthRef.current = panelWidth;
    if (!isMermaidCollapsed) lastExpandedWidthRef.current = panelWidth;
  }, [panelWidth, isMermaidCollapsed]);

  useEffect(() => {
    try {
      const storedWidth = localStorage.getItem(widthStorageKey);
      const parsed = storedWidth ? Number(storedWidth) : NaN;
      if (Number.isFinite(parsed) && parsed >= 200 && parsed <= window.innerWidth * 0.8) {
        setPanelWidth(parsed);
        startWidthRef.current = parsed;
        lastExpandedWidthRef.current = parsed;
      }
      const storedCollapsed = localStorage.getItem(collapsedStorageKey);
      if (storedCollapsed === "1") setIsMermaidCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  const setMermaidCollapsed = useCallback((collapsed: boolean) => {
    setIsMermaidCollapsed(collapsed);
    try {
      localStorage.setItem(collapsedStorageKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
    if (!collapsed) {
      setPanelWidth(lastExpandedWidthRef.current || 380);
    }
  }, []);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMermaidCollapsed) return;
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startXRef.current - ev.clientX;
      const newWidth = Math.min(
        Math.max(startWidthRef.current + delta, 200),
        window.innerWidth * 0.6,
      );
      setPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      try {
        localStorage.setItem(widthStorageKey, String(panelWidthRef.current));
      } catch {
        // ignore
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [isMermaidCollapsed, panelWidth, widthStorageKey]);

  useEffect(() => {
    setHasRequestedLoad(true);
    void loadDiagramFn(diagramId);
  }, [diagramId, loadDiagramFn]);

  // Auto-parse mermaid → flow nodes when diagram has mermaid code but no nodes
  // (e.g. diagrams created by the MCP server that only have mermaid code)
  useEffect(() => {
    if (isDiagramLoading || diagramLoadError) return;
    if (nodes.length === 0 && mermaidCode && mermaidCode.trim() !== "graph TD\n" && mermaidCode.trim() !== "graph TD") {
      void syncMermaidToFlow().then(() => {
        requestAnimationFrame(() => {
          void fitView({ padding: 0.18, duration: 250 });
        });
      });
    }
  }, [nodes.length, mermaidCode, syncMermaidToFlow, fitView, isDiagramLoading, diagramLoadError]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => persist(), 1000);
    return () => clearTimeout(timer);
  }, [nodes, edges, mermaidCode, persist]);

  // Keyboard shortcuts
  useEffect(() => {
    const isTextInput = (target: EventTarget | null) => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      if (target.closest(".monaco-editor")) return true;
      return false;
    };

    const isValidClipboardPayload = (value: unknown): value is { version: 1; nodes: unknown[]; edges: unknown[] } => {
      if (!value || typeof value !== "object") return false;
      const v = value as { version?: unknown; nodes?: unknown; edges?: unknown };
      return v.version === 1 && Array.isArray(v.nodes) && Array.isArray(v.edges);
    };

    const handler = (e: KeyboardEvent) => {
      if (isTextInput(e.target)) return;

      // CMD+S / Ctrl+S → save diagram
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        persist();
        return;
      }

      // CMD+Z / Ctrl+Z → undo (Shift → redo)
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      // Ctrl+Y → redo (Windows/Linux)
      if (e.ctrlKey && !e.metaKey && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }

      // CMD+L / Ctrl+L → auto-layout (Shift → top-to-bottom)
      if ((e.metaKey || e.ctrlKey) && e.key === "l") {
        e.preventDefault();
        const direction = e.shiftKey ? "DOWN" : "RIGHT";
        const closest = e.altKey;
        void runAutoLayout(direction, closest ? "CLOSEST" : "ORIENTED").then(() => {
          requestAnimationFrame(() => {
            void fitView({ padding: 0.18, duration: 250 });
          });
        });
        return;
      }

      // CMD+C / Ctrl+C → copy selected
      if ((e.metaKey || e.ctrlKey) && e.key === "c") {
        e.preventDefault();
        const payload = copySelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore
        }
        return;
      }

      // CMD+X / Ctrl+X → cut selected
      if ((e.metaKey || e.ctrlKey) && e.key === "x") {
        e.preventDefault();
        const payload = cutSelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore
        }
        return;
      }

      // CMD+V / Ctrl+V → paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v") {
        e.preventDefault();
        const fallbackPos = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const pos = lastPointerFlowPosRef.current ?? fallbackPos;

        const pasteFromSystemClipboard = async () => {
          try {
            const text = await navigator.clipboard?.readText?.();
            if (!text) {
              pasteClipboard(pos);
              return;
            }
            const parsed = JSON.parse(text) as unknown;
            if (isValidClipboardPayload(parsed)) {
              pasteClipboard(pos, parsed as any);
              return;
            }
          } catch {
            // ignore
          }
          pasteClipboard(pos);
        };

        void pasteFromSystemClipboard();
        return;
      }

      // CMD+G / Ctrl+G → group selected nodes
      if ((e.metaKey || e.ctrlKey) && e.key === "g" && !e.shiftKey) {
        e.preventDefault();
        groupSelectedNodes();
        return;
      }
      // CMD+Shift+G / Ctrl+Shift+G → ungroup selected group
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "G") {
        e.preventDefault();
        ungroupSelectedNodes();
        return;
      }
      // CMD+] / Ctrl+] → send to front; CMD+Shift+] → send forward one step
      if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        if (e.shiftKey) sendForward();
        else sendToFront();
        return;
      }
      // CMD+[ / Ctrl+[ → send to back; CMD+Shift+[ → send backward one step
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        if (e.shiftKey) sendBackward();
        else sendToBack();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, persist, undo, redo, runAutoLayout, fitView, groupSelectedNodes, ungroupSelectedNodes, sendToFront, sendToBack, sendForward, sendBackward, copySelected, cutSelected, pasteClipboard, screenToFlowPosition]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/archdiagram-shape") as ShapeType;
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(type, {
        x: position.x,
        y: position.y,
      });
    },
    [addNode, screenToFlowPosition]
  );

  // Double-click on a node → open edit modal
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    setEditingNode(node as ArchNode);
  }, []);

  // Double-click on an edge → open edit modal
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setEditingEdge(edge as ArchEdge);
  }, []);

  const handleNodeSave = useCallback((nodeId: string, data: Partial<ArchNode["data"]>) => {
    updateNodeData(nodeId, data);
  }, [updateNodeData]);

  const handleEdgeSave = useCallback((edgeId: string, updates: Partial<ArchEdge>) => {
    updateEdge(edgeId, updates);
  }, [updateEdge]);

  // Drag-to-reparent: when a node is dropped onto a group, make it a child
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, draggedNode) => {
      // Don't reparent group nodes themselves
      if (draggedNode.type === "groupNode") return;

      const allNodes = getNodes();
      const groupNodes = allNodes.filter((n) => n.type === "groupNode" && n.id !== draggedNode.id);

      // Compute absolute position of the dragged node
      let absX = draggedNode.position.x;
      let absY = draggedNode.position.y;
      if (draggedNode.parentId) {
        const parent = allNodes.find((n) => n.id === draggedNode.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      // Get measured dimensions
      const internal = getInternalNode(draggedNode.id) as (InternalNode & { measured?: { width?: number; height?: number } }) | undefined;
      const nodeW = internal?.measured?.width ?? draggedNode.width ?? 180;
      const nodeH = internal?.measured?.height ?? draggedNode.height ?? 70;
      const nodeCenterX = absX + nodeW / 2;
      const nodeCenterY = absY + nodeH / 2;

      // Find the smallest group that contains the node center
      let bestGroup: typeof groupNodes[0] | null = null;
      let bestArea = Infinity;

      for (const group of groupNodes) {
        const gInternal = getInternalNode(group.id) as (InternalNode & { measured?: { width?: number; height?: number } }) | undefined;
        const gW = gInternal?.measured?.width ?? (group.style as React.CSSProperties | undefined)?.width as number ?? 400;
        const gH = gInternal?.measured?.height ?? (group.style as React.CSSProperties | undefined)?.height as number ?? 300;

        if (
          nodeCenterX >= group.position.x &&
          nodeCenterX <= group.position.x + gW &&
          nodeCenterY >= group.position.y &&
          nodeCenterY <= group.position.y + gH
        ) {
          const area = gW * gH;
          if (area < bestArea) {
            bestArea = area;
            bestGroup = group;
          }
        }
      }

      if (bestGroup && draggedNode.parentId !== bestGroup.id) {
        // Reparent into a group
        reparentNode(draggedNode.id, bestGroup.id);
      } else if (!bestGroup && draggedNode.parentId) {
        // Dragged out of all groups → remove from parent
        reparentNode(draggedNode.id, null);
      }

      // Prevent node-on-node overlaps (groups are excluded).
      resolveOverlapsForNode(draggedNode.id);
    },
    [getNodes, getInternalNode, reparentNode, resolveOverlapsForNode],
  );

  if (!hasRequestedLoad || isDiagramLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--background)",
          color: "var(--text-muted)",
        }}
      >
        Loading diagram...
      </div>
    );
  }

  if (!currentDiagramId) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 12,
          background: "var(--background)",
          color: "var(--text-muted)",
        }}
      >
        <div>{diagramLoadError ?? "Diagram not found"}</div>
        <a
          href="/diagrams"
          style={{
            color: "var(--accent)",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Back to diagrams
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--background)" }}>
      {/* Header */}
      <div
        style={{
          height: 60,
          padding: "0 20px",
          background: "var(--panel-bg)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <a
            href="/diagrams"
            style={{
              color: "var(--text-muted)",
              textDecoration: "none",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontWeight: 500,
            }}
          >
            Diagrams
          </a>
          <span style={{ color: "var(--border)", fontSize: "16px", fontWeight: 300 }}>/</span>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>{diagramName}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Additional header actions could go here */}
        </div>
      </div>

      {diagramPersistError && (
        <div
          style={{
            padding: "8px 20px",
            background: "color-mix(in srgb, var(--danger) 12%, var(--panel-bg))",
            color: "var(--danger)",
            borderBottom: "1px solid color-mix(in srgb, var(--danger) 28%, var(--border))",
            fontSize: 12,
            fontWeight: 600,
          }}
          role="alert"
        >
          Save failed: {diagramPersistError}
        </div>
      )}

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* Diagram canvas area */}
        <div style={{ flex: 1, position: "relative", background: "var(--background)" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onPaneMouseMove={(e) => {
              lastPointerFlowPosRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            }}
            onPaneClick={(e) => {
              lastPointerFlowPosRef.current = screenToFlowPosition({ x: e.clientX, y: e.clientY });
            }}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onEdgeDoubleClick={onEdgeDoubleClick}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
              style: { stroke: "var(--edge-color)", strokeWidth: 1.5 },
            }}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            deleteKeyCode="Delete"
            selectionKeyCode="Shift"
            multiSelectionKeyCode="Shift"
            style={{ background: "transparent" }}
            proOptions={{ hideAttribution: true }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="var(--dot-color)"
            />
            <Controls position="bottom-right" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 4, background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--node-shadow)' }} />
          </ReactFlow>

          {/* Floating Toolbar (Left) */}
          <div style={{ position: "absolute", top: 20, left: 20, zIndex: 100, display: "flex", flexDirection: "column", gap: 12 }}>
            <ShapePalette />
            <Toolbar />
          </div>

        </div>

        {/* Resizable Mermaid editor panel */}
        {isMermaidCollapsed ? (
          <div
            style={{
              width: 36,
              flexShrink: 0,
              background: "var(--panel-bg)",
              borderLeft: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            <button
              aria-label="Expand Mermaid panel"
              title="Expand Mermaid panel"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface)";
                e.currentTarget.style.color = "var(--foreground)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
              onClick={() => setMermaidCollapsed(false)}
            >
              <PanelRightOpen size={18} />
            </button>
          </div>
        ) : (
          <>
            <div
              ref={resizeHandleRef}
              onMouseDown={onResizeStart}
              style={{
                width: "5px",
                height: "100%",
                cursor: "col-resize",
                background: isDragging ? "var(--accent)" : "var(--border)",
                transition: isDragging ? "none" : "background 0.15s",
                flexShrink: 0,
                zIndex: 50,
                opacity: isDragging ? 1 : 0.5,
              }}
              onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.opacity = "1"; }}
              onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.opacity = "0.5"; }}
            />
            <div style={{ width: panelWidth, minWidth: 200, maxWidth: "60vw", flexShrink: 0, background: "var(--panel-bg)", borderLeft: "1px solid var(--border)" }}>
              <MermaidPanel onCollapse={() => setMermaidCollapsed(true)} />
            </div>
          </>
        )}
      </div>

      {/* Edit modals */}
      {editingNode && (
        <NodeEditModal
          node={editingNode}
          onSave={handleNodeSave}
          onClose={() => setEditingNode(null)}
        />
      )}
      {editingEdge && (
        <EdgeEditModal
          edge={editingEdge}
          onSave={handleEdgeSave}
          onClose={() => setEditingEdge(null)}
        />
      )}
    </div>
  );
}
