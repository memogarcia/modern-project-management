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
import { ArrowLeft } from "lucide-react";
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
  const diagramName = useDiagramStore((s) => s.diagramName);
  const loadDiagramFn = useDiagramStore((s) => s.loadDiagram);
  const mermaidCode = useDiagramStore((s) => s.mermaidCode);
  const syncMermaidToFlow = useDiagramStore((s) => s.syncMermaidToFlow);
  const persist = useDiagramStore((s) => s.persist);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);
  const updateEdge = useDiagramStore((s) => s.updateEdge);
  const groupSelectedNodes = useDiagramStore((s) => s.groupSelectedNodes);
  const ungroupSelectedNodes = useDiagramStore((s) => s.ungroupSelectedNodes);
  const reparentNode = useDiagramStore((s) => s.reparentNode);
  const sendToFront = useDiagramStore((s) => s.sendToFront);
  const sendToBack = useDiagramStore((s) => s.sendToBack);
  const sendForward = useDiagramStore((s) => s.sendForward);
  const sendBackward = useDiagramStore((s) => s.sendBackward);
  const { getInternalNode, getNodes } = useReactFlow();

  // Modal state for editing nodes and edges
  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const [editingEdge, setEditingEdge] = useState<ArchEdge | null>(null);

  // ─── Resizable Mermaid panel ──────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(380);
  const [isDragging, setIsDragging] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(380);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
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
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [panelWidth]);

  useEffect(() => {
    loadDiagramFn(diagramId);
  }, [diagramId, loadDiagramFn]);

  // Auto-parse mermaid → flow nodes when diagram has mermaid code but no nodes
  // (e.g. diagrams created by the MCP server that only have mermaid code)
  useEffect(() => {
    if (nodes.length === 0 && mermaidCode && mermaidCode.trim() !== "graph TD\n" && mermaidCode.trim() !== "graph TD") {
      syncMermaidToFlow();
    }
  }, [nodes.length, mermaidCode, syncMermaidToFlow]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => persist(), 1000);
    return () => clearTimeout(timer);
  }, [nodes, edges, persist]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // CMD+S / Ctrl+S → save diagram
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        persist();
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
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteSelected, persist, groupSelectedNodes, ungroupSelectedNodes, sendToFront, sendToBack, sendForward, sendBackward]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("application/archdiagram-shape") as ShapeType;
      if (!type) return;
      const bounds = (e.target as HTMLElement)?.closest(".react-flow")?.getBoundingClientRect();
      if (!bounds) return;
      addNode(type, {
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
    },
    [addNode]
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
    },
    [getNodes, getInternalNode, reparentNode],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div
        style={{
          padding: "8px 16px",
          background: "var(--panel-bg)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <a
          href="/diagrams"
          style={{
            color: "var(--text-muted)",
            textDecoration: "none",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <ArrowLeft size={14} /> Diagrams
        </a>
        <span
          style={{
            color: "var(--border)",
            fontSize: "13px",
          }}
        >
          /
        </span>
        <span style={{ fontWeight: 600, fontSize: "14px" }}>{diagramName}</span>
      </div>

      {/* Toolbar */}
      <Toolbar />

      {/* Main content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Shape palette */}
        <ShapePalette />

        {/* Diagram canvas */}
        <div style={{ flex: 1, position: "relative" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeDoubleClick={onNodeDoubleClick}
            onNodeDragStop={onNodeDragStop}
            onEdgeDoubleClick={onEdgeDoubleClick}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{
              type: "smoothstep",
              animated: false,
            }}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            style={{ background: "var(--background)" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={20}
              size={1}
              color={theme === "dark" ? "#222" : "#ccc"}
            />
            <Controls />
          </ReactFlow>
        </div>

        {/* Resizable Mermaid editor panel */}
        <div
          ref={resizeHandleRef}
          onMouseDown={onResizeStart}
          style={{
            width: "5px",
            cursor: "col-resize",
            background: isDragging ? "var(--accent)" : "var(--border)",
            transition: isDragging ? "none" : "background 0.15s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => { if (!isDragging) e.currentTarget.style.background = "var(--accent)"; }}
          onMouseLeave={(e) => { if (!isDragging) e.currentTarget.style.background = "var(--border)"; }}
        />
        <div style={{ width: panelWidth, minWidth: 200, maxWidth: "60vw", flexShrink: 0 }}>
          <MermaidPanel />
        </div>
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
