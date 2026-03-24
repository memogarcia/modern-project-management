"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { type EdgeTypes, type EdgeMouseHandler, type InternalNode, type NodeMouseHandler, type OnNodeDrag, useReactFlow } from "@xyflow/react";
import DiagramEditorCanvas from "@/components/diagram-editor/DiagramEditorCanvas";
import DiagramEditorHeader from "@/components/diagram-editor/DiagramEditorHeader";
import DiagramEditorSidebar, { type DiagramEditorRightTab } from "@/components/diagram-editor/DiagramEditorSidebar";
import { DiagramEditorLoadingState, DiagramEditorMissingState } from "@/components/diagram-editor/DiagramEditorState";
import { useDiagramEditorKeyboardShortcuts } from "@/components/diagram-editor/useDiagramEditorKeyboardShortcuts";
import { getClientErrorMessage, LAYOUT_PRESETS, LAYOUT_PRESET_STORAGE_KEY_PREFIX, upsertPerspectiveInList } from "@/components/diagram-editor/utils";
import NodeEditModal from "@/components/NodeEditModal";
import EdgeEditModal from "@/components/EdgeEditModal";
import { useTheme } from "@/components/ThemeProvider";
import SmartSmoothStepEdge from "@/components/edges/SmartSmoothStepEdge";
import {
  buildSuggestedPerspective,
  computePerspectiveVisibility,
  createPerspectiveFromSelection,
  type DiagramPerspective,
  type DiagramPerspectiveKind,
} from "@/lib/diagramPerspectives";
import { analyzeDiagramQuality, type DiagramQualityEntityRef } from "@/lib/diagramQuality";
import type { LayoutPresetId } from "@/lib/layout";
import {
  deleteDiagramPerspective,
  loadDiagramPerspectives,
  saveDiagramPerspective,
} from "@/lib/storage";
import { nodeTypes } from "@/components/nodes";
import type { ArchEdge, ArchNode, ShapeType, TroubleshootingSession } from "@/lib/types";
import { useDiagramStore } from "@/store/diagramStore";

interface DiagramEditorProps { diagramId: string; }

const edgeTypes: EdgeTypes = { smoothstep: SmartSmoothStepEdge };

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
  const layoutPreset = useDiagramStore((s) => s.layoutPreset);
  const setLayoutPreset = useDiagramStore((s) => s.setLayoutPreset);
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
  const selectEntities = useDiagramStore((s) => s.selectEntities);
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
  const [activeRightTab, setActiveRightTab] = useState<DiagramEditorRightTab>("mermaid");
  const [perspectives, setPerspectives] = useState<DiagramPerspective[]>([]);
  const [isPerspectivesLoading, setIsPerspectivesLoading] = useState(true);
  const [perspectiveError, setPerspectiveError] = useState<string | null>(null);
  const [activePerspectiveId, setActivePerspectiveId] = useState<string | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(380);
  const lastPointerFlowPosRef = useRef<{ x: number; y: number } | null>(null);
  const layoutPresetLoadedRef = useRef(false);
  const activePerspectiveStorageKey = `planview.perspectives.active.${diagramId}`;
  const layoutPresetStorageKey = `${LAYOUT_PRESET_STORAGE_KEY_PREFIX}${diagramId}`;

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

  useEffect(() => {
    try {
      setActivePerspectiveId(localStorage.getItem(activePerspectiveStorageKey));
    } catch {
      setActivePerspectiveId(null);
    }
  }, [activePerspectiveStorageKey]);

  useEffect(() => {
    layoutPresetLoadedRef.current = false;
    try {
      const storedPreset = localStorage.getItem(layoutPresetStorageKey);
      if (storedPreset && LAYOUT_PRESETS.has(storedPreset as LayoutPresetId)) {
        setLayoutPreset(storedPreset as LayoutPresetId);
      } else {
        setLayoutPreset("diagram-horizontal");
      }
    } catch {
      // ignore localStorage failures in restricted environments.
    } finally {
      layoutPresetLoadedRef.current = true;
    }
  }, [layoutPresetStorageKey, setLayoutPreset]);

  useEffect(() => {
    let cancelled = false;
    setIsPerspectivesLoading(true);
    setPerspectiveError(null);
    setPerspectives([]);

    const loadPerspectives = async () => {
      try {
        const saved = await loadDiagramPerspectives(diagramId);
        if (cancelled) return;
        setPerspectives(saved);
      } catch (error) {
        if (cancelled) return;
        setPerspectiveError(getClientErrorMessage(error, "Failed to load saved perspectives"));
        setPerspectives([]);
      } finally {
        if (!cancelled) {
          setIsPerspectivesLoading(false);
        }
      }
    };

    void loadPerspectives();
    return () => {
      cancelled = true;
    };
  }, [diagramId]);

  useEffect(() => {
    try {
      if (!activePerspectiveId) {
        localStorage.removeItem(activePerspectiveStorageKey);
        return;
      }
      localStorage.setItem(activePerspectiveStorageKey, activePerspectiveId);
    } catch {
      // ignore localStorage failures in restricted environments.
    }
  }, [activePerspectiveId, activePerspectiveStorageKey]);

  useEffect(() => {
    if (!layoutPresetLoadedRef.current) return;
    try {
      localStorage.setItem(layoutPresetStorageKey, layoutPreset);
    } catch {
      // ignore localStorage failures in restricted environments.
    }
  }, [layoutPreset, layoutPresetStorageKey]);

  useEffect(() => {
    if (isPerspectivesLoading) return;
    if (!activePerspectiveId) return;
    if (perspectives.some((perspective) => perspective.id === activePerspectiveId)) return;
    setActivePerspectiveId(null);
  }, [activePerspectiveId, isPerspectivesLoading, perspectives]);

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

  useDiagramEditorKeyboardShortcuts({
    lastPointerFlowPosRef,
    layoutPreset,
    persist,
    undo,
    redo,
    runAutoLayout,
    fitView,
    screenToFlowPosition,
    copySelected,
    cutSelected,
    pasteClipboard,
    groupSelectedNodes,
    ungroupSelectedNodes,
    sendToFront,
    sendToBack,
    sendForward,
    sendBackward,
    deleteSelected,
  });

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

  const handlePanePointerUpdate = useCallback(
    (clientX: number, clientY: number) => {
      lastPointerFlowPosRef.current = screenToFlowPosition({ x: clientX, y: clientY });
    },
    [screenToFlowPosition]
  );

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
  const qualitySummary = useMemo(() => analyzeDiagramQuality(nodes, edges), [nodes, edges]);
  const staleNodeIdSet = useMemo(() => new Set(qualitySummary.staleNodeIds), [qualitySummary.staleNodeIds]);
  const unclearEdgeIdSet = useMemo(() => new Set(qualitySummary.unclearEdgeIds), [qualitySummary.unclearEdgeIds]);
  const activePerspective = useMemo(
    () => perspectives.find((perspective) => perspective.id === activePerspectiveId) ?? null,
    [activePerspectiveId, perspectives]
  );
  const perspectiveVisibility = useMemo(
    () => (activePerspective ? computePerspectiveVisibility(activePerspective, nodes, edges) : null),
    [activePerspective, edges, nodes]
  );
  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => {
        const hidden = perspectiveVisibility ? !perspectiveVisibility.visibleNodeIds.has(node.id) : false;

        if (node.type !== "archNode") {
          return { ...node, hidden } as typeof node;
        }

        const isStale = staleNodeIdSet.has(node.id);
        return {
          ...node,
          hidden,
          data: {
            ...node.data,
            renderBadgeLabel: isStale ? "Stale" : undefined,
            renderBadgeTone: isStale ? "warning" : undefined,
            renderBadgeTooltip: isStale ? "This component has not been verified in more than 90 days." : undefined,
          },
        } as typeof node;
      }),
    [nodes, perspectiveVisibility, staleNodeIdSet]
  );
  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const hidden = perspectiveVisibility ? !perspectiveVisibility.visibleEdgeIds.has(edge.id) : false;
        const isUnclear = unclearEdgeIdSet.has(edge.id);

        return {
          ...edge,
          hidden,
          style: isUnclear
            ? {
                ...(edge.style ?? {}),
                stroke: "var(--warning)",
                strokeDasharray: "6 4",
              }
            : edge.style,
          data: {
            ...(edge.data ?? {}),
            renderWarningLabel: isUnclear ? "Needs label" : undefined,
            renderWarningTone: isUnclear ? "warning" : undefined,
          },
        } as ArchEdge;
      }),
    [edges, perspectiveVisibility, unclearEdgeIdSet]
  );

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

  const refitCanvas = useCallback(() => {
    requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 250 });
    });
  }, [fitView]);

  const handleFocusEntity = useCallback(
    (entity: DiagramQualityEntityRef) => {
      if (activePerspectiveId) {
        setActivePerspectiveId(null);
      }
      if (entity.type === "node") {
        selectEntities([entity.id], []);
        refitCanvas();
        return;
      }
      selectEntities([], [entity.id]);
      refitCanvas();
    },
    [activePerspectiveId, refitCanvas, selectEntities]
  );

  const applyPerspective = useCallback(
    (perspectiveId: string | null) => {
      setActivePerspectiveId(perspectiveId);

      if (!perspectiveId) {
        selectEntities([], []);
        refitCanvas();
        return;
      }

      const nextPerspective = perspectives.find((perspective) => perspective.id === perspectiveId);
      if (!nextPerspective) return;
      selectEntities(nextPerspective.nodeIds, nextPerspective.edgeIds);
      refitCanvas();
    },
    [perspectives, refitCanvas, selectEntities]
  );

  const upsertPerspective = useCallback(
    async (perspective: DiagramPerspective) => {
      setPerspectiveError(null);
      const saved = await saveDiagramPerspective(diagramId, perspective);
      setPerspectives((current) => upsertPerspectiveInList(current, saved));
      return saved;
    },
    [diagramId]
  );

  const handleCreateCustomPerspective = useCallback(
    async (title: string, description: string) => {
      const perspective = createPerspectiveFromSelection({
        title,
        description,
        selectedNodeIds,
        selectedEdgeIds,
        edges,
      });
      try {
        const saved = await upsertPerspective(perspective);
        setActivePerspectiveId(saved.id);
        selectEntities(saved.nodeIds, saved.edgeIds);
        refitCanvas();
      } catch (error) {
        setPerspectiveError(getClientErrorMessage(error, "Failed to save perspective"));
      }
    },
    [edges, refitCanvas, selectEntities, selectedEdgeIds, selectedNodeIds, upsertPerspective]
  );

  const handleUpdatePerspectiveFromSelection = useCallback(
    async (perspectiveId: string) => {
      const existing = perspectives.find((perspective) => perspective.id === perspectiveId);
      if (!existing) return;

      const updated = createPerspectiveFromSelection({
        title: existing.title,
        description: existing.description,
        selectedNodeIds,
        selectedEdgeIds,
        edges,
        existingId: existing.id,
        createdAt: existing.createdAt,
      });

      updated.kind = existing.kind;
      try {
        const saved = await upsertPerspective(updated);
        if (activePerspectiveId === saved.id) {
          setActivePerspectiveId(saved.id);
          selectEntities(saved.nodeIds, saved.edgeIds);
          refitCanvas();
        }
      } catch (error) {
        setPerspectiveError(getClientErrorMessage(error, "Failed to update perspective"));
      }
    },
    [activePerspectiveId, edges, perspectives, refitCanvas, selectEntities, selectedEdgeIds, selectedNodeIds, upsertPerspective]
  );

  const handleUpsertSuggestedPerspective = useCallback(
    async (kind: Exclude<DiagramPerspectiveKind, "custom">, sessions: TroubleshootingSession[]) => {
      const existing = perspectives.find((perspective) => perspective.kind === kind);
      const perspective = buildSuggestedPerspective(kind, nodes, edges, sessions, existing);
      try {
        const saved = await upsertPerspective(perspective);
        setActivePerspectiveId(saved.id);
        selectEntities(saved.nodeIds, saved.edgeIds);
        refitCanvas();
      } catch (error) {
        setPerspectiveError(getClientErrorMessage(error, "Failed to save suggested perspective"));
      }
    },
    [edges, nodes, perspectives, refitCanvas, selectEntities, upsertPerspective]
  );

  const handleDeletePerspective = useCallback(
    async (perspectiveId: string) => {
      try {
        setPerspectiveError(null);
        await deleteDiagramPerspective(diagramId, perspectiveId);
        setPerspectives((current) => current.filter((perspective) => perspective.id !== perspectiveId));
        if (activePerspectiveId === perspectiveId) {
          setActivePerspectiveId(null);
          selectEntities([], []);
          refitCanvas();
        }
      } catch (error) {
        setPerspectiveError(getClientErrorMessage(error, "Failed to delete perspective"));
      }
    },
    [activePerspectiveId, diagramId, refitCanvas, selectEntities]
  );

  if (!hasRequestedLoad || isDiagramLoading) {
    return <DiagramEditorLoadingState />;
  }

  if (!currentDiagramId) {
    return <DiagramEditorMissingState errorMessage={diagramLoadError ?? "Diagram not found"} />;
  }

  return (
    <div className="workspace-page bg-transparent">
      <DiagramEditorHeader
        diagramName={diagramName}
        theme={theme}
        qualitySummary={qualitySummary}
        activePerspectiveTitle={activePerspective?.title ?? null}
        onClearPerspective={() => applyPerspective(null)}
      />

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
        <DiagramEditorCanvas
          renderedNodes={renderedNodes}
          renderedEdges={renderedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onPanePointerUpdate={handlePanePointerUpdate}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          onEdgeDoubleClick={onEdgeDoubleClick}
        />

        <DiagramEditorSidebar
          isMermaidCollapsed={isMermaidCollapsed}
          setMermaidCollapsed={setMermaidCollapsed}
          resizeHandleRef={resizeHandleRef}
          onResizeStart={onResizeStart}
          isDragging={isDragging}
          panelWidth={panelWidth}
          activeRightTab={activeRightTab}
          onRightTabChange={setActiveRightTab}
          mermaidError={mermaidError}
          qualityWarningCount={qualitySummary.warningCount}
          currentDiagramId={currentDiagramId}
          nodes={nodes}
          edges={edges}
          selectedNodeIds={selectedNodeIds}
          selectedEdgeIds={selectedEdgeIds}
          perspectives={perspectives}
          isPerspectivesLoading={isPerspectivesLoading}
          perspectiveError={perspectiveError}
          activePerspectiveId={activePerspectiveId}
          onApplyPerspective={applyPerspective}
          onCreateCustomPerspective={handleCreateCustomPerspective}
          onUpdatePerspectiveFromSelection={handleUpdatePerspectiveFromSelection}
          onUpsertSuggestedPerspective={handleUpsertSuggestedPerspective}
          onDeletePerspective={handleDeletePerspective}
          onFocusEntity={handleFocusEntity}
        />
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
