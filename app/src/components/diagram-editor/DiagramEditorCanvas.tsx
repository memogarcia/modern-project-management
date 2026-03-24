"use client";

import type { DragEvent } from "react";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  type EdgeMouseHandler,
  type EdgeTypes,
  type NodeMouseHandler,
  type OnConnect,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type NodeTypes,
} from "@xyflow/react";
import ShapePalette from "@/components/ShapePalette";
import Toolbar from "@/components/Toolbar";
import type { ArchEdge, DiagramNode } from "@/lib/types";

interface DiagramEditorCanvasProps {
  renderedNodes: DiagramNode[];
  renderedEdges: ArchEdge[];
  onNodesChange: OnNodesChange<DiagramNode>;
  onEdgesChange: OnEdgesChange<ArchEdge>;
  onConnect: OnConnect;
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
  onPanePointerUpdate: (clientX: number, clientY: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onNodeDoubleClick: NodeMouseHandler<DiagramNode>;
  onNodeDragStop: OnNodeDrag<DiagramNode>;
  onEdgeDoubleClick: EdgeMouseHandler<ArchEdge>;
}

export default function DiagramEditorCanvas({
  renderedNodes,
  renderedEdges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeTypes,
  edgeTypes,
  onPanePointerUpdate,
  onDragOver,
  onDrop,
  onNodeDoubleClick,
  onNodeDragStop,
  onEdgeDoubleClick,
}: DiagramEditorCanvasProps) {
  return (
    <div className="relative flex min-w-0 flex-1 overflow-hidden rounded-[24px] border border-[var(--panel-border)] bg-[var(--canvas-bg)] shadow-[var(--card-shadow)] md:rounded-[34px]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(66,98,255,0.12),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(90,180,255,0.12),transparent_26%)]" />

      <ReactFlow
        nodes={renderedNodes}
        edges={renderedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onPaneMouseMove={(event) => {
          onPanePointerUpdate(event.clientX, event.clientY);
        }}
        onPaneClick={(event) => {
          onPanePointerUpdate(event.clientX, event.clientY);
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
  );
}
