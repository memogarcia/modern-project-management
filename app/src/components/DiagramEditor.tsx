"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  type EdgeTypes,
  type EdgeMouseHandler,
  type InternalNode,
  type NodeMouseHandler,
  type OnNodeDrag,
  useReactFlow,
} from "@xyflow/react";
import { PanelRightOpen } from "lucide-react";
import MermaidPanel from "@/components/MermaidPanel";
import NodeEditModal from "@/components/NodeEditModal";
import EdgeEditModal from "@/components/EdgeEditModal";
import ShapePalette from "@/components/ShapePalette";
import Toolbar from "@/components/Toolbar";
import TroubleshootingPanel from "@/components/TroubleshootingPanel";
import { useTheme } from "@/components/ThemeProvider";
import SmartSmoothStepEdge from "@/components/edges/SmartSmoothStepEdge";
import { nodeTypes } from "@/components/nodes";
import type { ArchEdge, ArchNode, ShapeType } from "@/lib/types";
import { useDiagramStore } from "@/store/diagramStore";

interface DiagramEditorProps {
  diagramId: string;
}

const edgeTypes: EdgeTypes = {
  smoothstep: SmartSmoothStepEdge,
};

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
  const mermaidError = useDiagramStore((s) => s.mermaidError);
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

  const [editingNode, setEditingNode] = useState<ArchNode | null>(null);
  const [editingEdge, setEditingEdge] = useState<ArchEdge | null>(null);
  const [hasRequestedLoad, setHasRequestedLoad] = useState(false);

  const widthStorageKey = "archdiagram.mermaid.width";
  const collapsedStorageKey = "archdiagram.mermaid.collapsed";

  const [panelWidth, setPanelWidth] = useState(380);
  const panelWidthRef = useRef(380);
  const lastExpandedWidthRef = useRef(380);
  const [isMermaidCollapsed, setIsMermaidCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<"mermaid" | "investigations">("mermaid");
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
      const parsed = storedWidth ? Number(storedWidth) : Number.NaN;
      if (Number.isFinite(parsed) && parsed >= 240 && parsed <= window.innerWidth * 0.8) {
        setPanelWidth(parsed);
        startWidthRef.current = parsed;
        lastExpandedWidthRef.current = parsed;
      }

      if (localStorage.getItem(collapsedStorageKey) === "1") {
        setIsMermaidCollapsed(true);
      }
    } catch {
      // ignore localStorage failures in restricted environments.
    }
  }, []);

  const setMermaidCollapsed = useCallback((collapsed: boolean) => {
    setIsMermaidCollapsed(collapsed);
    try {
      localStorage.setItem(collapsedStorageKey, collapsed ? "1" : "0");
    } catch {
      // ignore localStorage failures in restricted environments.
    }
    if (!collapsed) {
      setPanelWidth(lastExpandedWidthRef.current || 380);
    }
  }, []);

  const onResizeStart = useCallback(
    (event: ReactMouseEvent) => {
      if (isMermaidCollapsed) return;
      event.preventDefault();
      setIsDragging(true);
      startXRef.current = event.clientX;
      startWidthRef.current = panelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startXRef.current - moveEvent.clientX;
        const newWidth = Math.min(Math.max(startWidthRef.current + delta, 260), window.innerWidth * 0.56);
        setPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        setIsDragging(false);
        try {
          localStorage.setItem(widthStorageKey, String(panelWidthRef.current));
        } catch {
          // ignore localStorage failures in restricted environments.
        }
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [isMermaidCollapsed, panelWidth]
  );

  useEffect(() => {
    setHasRequestedLoad(true);
    void loadDiagramFn(diagramId);
  }, [diagramId, loadDiagramFn]);

  useEffect(() => {
    if (isDiagramLoading || diagramLoadError) return;
    if (nodes.length === 0 && mermaidCode && mermaidCode.trim() !== "graph TD\n" && mermaidCode.trim() !== "graph TD") {
      void syncMermaidToFlow().then(() => {
        requestAnimationFrame(() => {
          void fitView({ padding: 0.18, duration: 250 });
        });
      });
    }
  }, [diagramLoadError, fitView, isDiagramLoading, mermaidCode, nodes.length, syncMermaidToFlow]);

  useEffect(() => {
    const timer = setTimeout(() => persist(), 1000);
    return () => clearTimeout(timer);
  }, [edges, mermaidCode, nodes, persist]);

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
      const payload = value as { version?: unknown; nodes?: unknown; edges?: unknown };
      return payload.version === 1 && Array.isArray(payload.nodes) && Array.isArray(payload.edges);
    };

    const handler = (event: KeyboardEvent) => {
      if (isTextInput(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        persist();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (event.ctrlKey && !event.metaKey && (event.key === "y" || event.key === "Y")) {
        event.preventDefault();
        redo();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "l") {
        event.preventDefault();
        const direction = event.shiftKey ? "DOWN" : "RIGHT";
        const closest = event.altKey;
        void runAutoLayout(direction, closest ? "CLOSEST" : "ORIENTED").then(() => {
          requestAnimationFrame(() => {
            void fitView({ padding: 0.18, duration: 250 });
          });
        });
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "c") {
        event.preventDefault();
        const payload = copySelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore clipboard failures.
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "x") {
        event.preventDefault();
        const payload = cutSelected();
        if (!payload) return;
        try {
          void navigator.clipboard?.writeText(JSON.stringify(payload));
        } catch {
          // ignore clipboard failures.
        }
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "v") {
        event.preventDefault();
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
            // ignore clipboard failures.
          }
          pasteClipboard(pos);
        };

        void pasteFromSystemClipboard();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "g" && !event.shiftKey) {
        event.preventDefault();
        groupSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "G") {
        event.preventDefault();
        ungroupSelectedNodes();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "]") {
        event.preventDefault();
        if (event.shiftKey) sendForward();
        else sendToFront();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "[") {
        event.preventDefault();
        if (event.shiftKey) sendBackward();
        else sendToBack();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        deleteSelected();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    copySelected,
    cutSelected,
    deleteSelected,
    fitView,
    groupSelectedNodes,
    pasteClipboard,
    persist,
    redo,
    runAutoLayout,
    screenToFlowPosition,
    sendBackward,
    sendForward,
    sendToBack,
    sendToFront,
    undo,
    ungroupSelectedNodes,
  ]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/archdiagram-shape") as ShapeType;
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(type, position);
    },
    [addNode, screenToFlowPosition]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    setEditingNode(node as ArchNode);
  }, []);

  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setEditingEdge(edge as ArchEdge);
  }, []);

  const handleNodeSave = useCallback(
    (nodeId: string, data: Partial<ArchNode["data"]>) => {
      updateNodeData(nodeId, data);
    },
    [updateNodeData]
  );

  const handleEdgeSave = useCallback(
    (edgeId: string, updates: Partial<ArchEdge>) => {
      updateEdge(edgeId, updates);
    },
    [updateEdge]
  );

  const selectedNodeIds = useMemo(() => nodes.filter((node) => node.selected).map((node) => node.id), [nodes]);
  const selectedEdgeIds = useMemo(() => edges.filter((edge) => edge.selected).map((edge) => edge.id), [edges]);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, draggedNode) => {
      if (draggedNode.type === "groupNode") return;

      const allNodes = getNodes();
      const groupNodes = allNodes.filter((node) => node.type === "groupNode" && node.id !== draggedNode.id);

      let absX = draggedNode.position.x;
      let absY = draggedNode.position.y;
      if (draggedNode.parentId) {
        const parent = allNodes.find((node) => node.id === draggedNode.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
        }
      }

      const internal = getInternalNode(draggedNode.id) as (InternalNode & { measured?: { width?: number; height?: number } }) | undefined;
      const nodeW = internal?.measured?.width ?? draggedNode.width ?? 180;
      const nodeH = internal?.measured?.height ?? draggedNode.height ?? 70;
      const nodeCenterX = absX + nodeW / 2;
      const nodeCenterY = absY + nodeH / 2;

      let bestGroup: (typeof groupNodes)[number] | null = null;
      let bestArea = Number.POSITIVE_INFINITY;

      for (const group of groupNodes) {
        const groupInternal = getInternalNode(group.id) as (InternalNode & { measured?: { width?: number; height?: number } }) | undefined;
        const groupStyle = group.style as CSSProperties | undefined;
        const groupWidth = groupInternal?.measured?.width ?? (groupStyle?.width as number | undefined) ?? 400;
        const groupHeight = groupInternal?.measured?.height ?? (groupStyle?.height as number | undefined) ?? 300;

        if (
          nodeCenterX >= group.position.x &&
          nodeCenterX <= group.position.x + groupWidth &&
          nodeCenterY >= group.position.y &&
          nodeCenterY <= group.position.y + groupHeight
        ) {
          const area = groupWidth * groupHeight;
          if (area < bestArea) {
            bestArea = area;
            bestGroup = group;
          }
        }
      }

      if (bestGroup && draggedNode.parentId !== bestGroup.id) {
        reparentNode(draggedNode.id, bestGroup.id);
      } else if (!bestGroup && draggedNode.parentId) {
        reparentNode(draggedNode.id, null);
      }

      resolveOverlapsForNode(draggedNode.id);
    },
    [getInternalNode, getNodes, reparentNode, resolveOverlapsForNode]
  );

  if (!hasRequestedLoad || isDiagramLoading) {
    return (
      <div className="workspace-page items-center justify-center text-sm text-[var(--text-muted)]">
        Loading diagram...
      </div>
    );
  }

  if (!currentDiagramId) {
    return (
      <div className="workspace-page items-center justify-center gap-4 text-center text-sm text-[var(--text-muted)]">
        <div>{diagramLoadError ?? "Diagram not found"}</div>
        <a href="/diagrams" className="rounded-full bg-[var(--accent)] px-4 py-2 font-semibold text-[var(--accent-foreground)] no-underline">
          Back to diagrams
        </a>
      </div>
    );
  }

  return (
    <div className="workspace-page bg-transparent">
      <div className="flex min-h-[44px] shrink-0 items-center justify-between border-b border-[var(--panel-border)] px-3 py-2 md:min-h-[52px] md:px-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Canvas workspace
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2.5 md:gap-3">
            <a
              href="/diagrams"
              className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-muted)] no-underline transition-colors hover:text-[var(--foreground)] md:px-3 md:text-xs"
            >
              Diagrams
            </a>
            <span className="truncate text-base font-semibold tracking-[-0.03em] text-[var(--foreground)] md:text-lg">
              {diagramName}
            </span>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            Grid snap enabled
          </span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
            {theme === "dark" ? "Dark workspace" : "Light workspace"}
          </span>
        </div>
      </div>

      {diagramPersistError && (
        <div
          className="mx-4 mt-4 rounded-[20px] border px-4 py-3 text-sm font-medium"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 24%, var(--border))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--surface-raised))",
            color: "var(--danger)",
          }}
          role="alert"
        >
          Save failed: {diagramPersistError}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2 px-2 pb-2 pt-2 md:gap-3 md:px-4 md:pb-4 md:pt-4">
        <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--canvas-bg)] shadow-[var(--card-shadow)] md:rounded-[34px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(66,98,255,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(90,180,255,0.12),transparent_26%)]" />

          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onPaneMouseMove={(event) => {
              lastPointerFlowPosRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
            }}
            onPaneClick={(event) => {
              lastPointerFlowPosRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
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
              style: { stroke: "var(--edge-color)", strokeWidth: 1.8 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 14,
                height: 14,
                color: "var(--edge-color)",
              },
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
            <Background variant={BackgroundVariant.Dots} gap={24} size={1.6} color="var(--dot-color)" />
            <Controls position="bottom-right" />
          </ReactFlow>

          <div className="pointer-events-none absolute left-2 right-2 top-2 z-[100] md:left-4 md:right-4 md:top-4">
            <div className="planview-scroll-panel pointer-events-auto flex justify-center overflow-x-auto pb-1">
              <Toolbar />
            </div>
          </div>

          <div className="absolute bottom-3 left-3 top-[54px] z-[100] flex flex-col gap-2 md:bottom-5 md:left-5 md:top-[68px] md:gap-3">
              <ShapePalette />
              <div className="floating-panel hidden max-w-[180px] rounded-[18px] px-2.5 py-2 text-[10px] text-[var(--text-muted)] md:block md:max-w-[220px] md:rounded-[24px] md:px-4 md:py-3 md:text-xs">
                Drag shapes onto the board. Double-click nodes or edges to edit details.
              </div>
          </div>
        </div>

        {isMermaidCollapsed ? (
          <div className="flex w-[48px] shrink-0 items-center justify-center rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--card-shadow)] md:w-[58px] md:rounded-[28px]">
            <button
              type="button"
              aria-label="Expand Mermaid panel"
              title="Expand Mermaid panel"
              className="flex h-9 w-9 items-center justify-center rounded-[18px] border border-[var(--border)] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] md:h-11 md:w-11 md:rounded-2xl"
              onClick={() => setMermaidCollapsed(false)}
            >
              <PanelRightOpen size={16} />
            </button>
          </div>
        ) : (
          <>
            <div
              ref={resizeHandleRef}
              onMouseDown={onResizeStart}
              className="relative hidden w-3 shrink-0 cursor-col-resize md:block"
            >
              <div
                className="absolute bottom-8 left-1/2 top-8 -translate-x-1/2 rounded-full transition-colors"
                style={{
                  width: 4,
                  background: isDragging ? "var(--accent)" : "color-mix(in srgb, var(--border) 78%, transparent)",
                }}
              />
            </div>

            <div
              className="flex shrink-0 flex-col overflow-hidden rounded-[22px] border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-[var(--card-shadow)] md:rounded-[30px]"
              style={{ width: panelWidth, minWidth: 260, maxWidth: "56vw" }}
            >
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-2.5 py-2.5 md:px-3 md:py-3">
                <button
                  type="button"
                  className={`rounded-[18px] px-3 py-1.5 text-[11px] font-semibold transition-colors md:rounded-2xl md:px-4 md:py-2 md:text-xs ${
                    activeRightTab === "mermaid"
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_24px_rgba(66,98,255,0.18)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => setActiveRightTab("mermaid")}
                >
                  Mermaid{mermaidError ? " !" : ""}
                </button>
                <button
                  type="button"
                  className={`rounded-[18px] px-3 py-1.5 text-[11px] font-semibold transition-colors md:rounded-2xl md:px-4 md:py-2 md:text-xs ${
                    activeRightTab === "investigations"
                      ? "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_12px_24px_rgba(66,98,255,0.18)]"
                      : "text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
                  }`}
                  onClick={() => setActiveRightTab("investigations")}
                >
                  Investigations
                </button>
              </div>

              <div className="min-h-0 flex-1">
                {activeRightTab === "mermaid" ? (
                  <MermaidPanel onCollapse={() => setMermaidCollapsed(true)} />
                ) : (
                  <TroubleshootingPanel
                    diagramId={currentDiagramId}
                    nodes={nodes as never[]}
                    edges={edges as never[]}
                    selectedNodeIds={selectedNodeIds}
                    selectedEdgeIds={selectedEdgeIds}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {editingNode && (
        <NodeEditModal
          diagramId={currentDiagramId}
          node={editingNode}
          onSave={handleNodeSave}
          onClose={() => setEditingNode(null)}
        />
      )}
      {editingEdge && (
        <EdgeEditModal edge={editingEdge} onSave={handleEdgeSave} onClose={() => setEditingEdge(null)} />
      )}
    </div>
  );
}
